/*
  Database abstraction layer.
  Uses PostgreSQL when DB_HOST is set (Docker/production),
  falls back to SQLite (better-sqlite3) for local development.
  
  Exposes a unified query(sql, params) interface.
*/

const USE_PG = !!process.env.DB_HOST;

let _query;

if (USE_PG) {
  // ---- PostgreSQL ----
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'sgf_jfal',
    user: process.env.DB_USER || 'sgf',
    password: process.env.DB_PASS || 'sgf123',
  });
  pool.on('error', (err) => console.error('PG idle client error', err));

  _query = async (sql, params = []) => {
    // Convert $1, $2 style params (already PG style)
    const result = await pool.query(sql, params);
    return result;
  };

  console.log('📦 Using PostgreSQL');
} else {
  // ---- SQLite (local dev) ----
  const Database = require('better-sqlite3');
  const path = require('path');
  const dbPath = path.join(__dirname, 'sgf_jfal.db');
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  _query = async (sql, params = []) => {
    // Convert PostgreSQL $1, $2 params to SQLite ? params
    // Handle duplicate $N references by expanding params array
    const paramRefs = [];
    const sqliteSql = sql.replace(/\$(\d+)/g, (_, num) => {
      paramRefs.push(parseInt(num) - 1); // 0-indexed
      return '?';
    });
    // Expand params so each ? gets the right value (handles $1 used twice)
    const expandedParams = paramRefs.length > 0
      ? paramRefs.map(i => params[i])
      : params;

    // Handle PostgreSQL-specific syntax
    let finalSql = sqliteSql
      .replace(/SERIAL PRIMARY KEY/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/\bSERIAL\b/gi, 'INTEGER')
      .replace(/\bVARCHAR\(\d+\)/gi, 'TEXT')
      .replace(/\bTIMESTAMP\b/gi, 'TEXT')
      .replace(/\bBOOLEAN\b/gi, 'INTEGER')
      .replace(/DEFAULT NOW\(\)/gi, "DEFAULT (datetime('now'))")
      .replace(/NOW\(\)/gi, "datetime('now')")
      .replace(/ON CONFLICT DO NOTHING/gi, 'ON CONFLICT DO NOTHING')
      .replace(/RETURNING \*/gi, '')
      .replace(/RETURNING [^;,)]+/gi, '')
      .replace(/\bCOUNT\(\*\) FILTER \(WHERE ([^)]+)\)/gi, 'SUM(CASE WHEN $1 THEN 1 ELSE 0 END)')
      .replace(/CHECK \([^)]+\)/gi, ''); // Remove CHECK constraints for simplicity

    const trimmed = finalSql.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');
    const isInsert = trimmed.startsWith('INSERT');
    const isUpdate = trimmed.startsWith('UPDATE');
    const isDelete = trimmed.startsWith('DELETE');

    try {
      if (isSelect) {
        const rows = db.prepare(finalSql).all(...expandedParams);
        return { rows, rowCount: rows.length };
      } else if (isInsert) {
        const info = db.prepare(finalSql).run(...expandedParams);
        // Re-fetch the inserted row(s) for RETURNING emulation
        if (info.changes > 0) {
          const tableName = extractTableName(sql);
          if (tableName && info.lastInsertRowid) {
            const rows = db.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).all(info.lastInsertRowid);
            // Convert SQLite integer booleans back
            rows.forEach(r => {
              if ('ativo' in r) r.ativo = !!r.ativo;
            });
            return { rows, rowCount: info.changes };
          }
        }
        return { rows: [], rowCount: info.changes };
      } else if (isUpdate) {
        const info = db.prepare(finalSql).run(...expandedParams);
        // Emulate RETURNING by re-fetching
        if (info.changes > 0) {
          const tableName = extractTableName(sql);
          if (tableName && expandedParams.length > 0) {
            // The last param is usually the id
            const idParam = expandedParams[expandedParams.length - 1];
            const rows = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).all(idParam);
            rows.forEach(r => {
              if ('ativo' in r) r.ativo = !!r.ativo;
            });
            return { rows, rowCount: info.changes };
          }
        }
        return { rows: [], rowCount: info.changes };
      } else if (isDelete) {
        const info = db.prepare(finalSql).run(...expandedParams);
        return { rows: [], rowCount: info.changes };
      } else {
        // DDL or other
        // Split multiple statements for SQLite
        const statements = finalSql.split(';').filter(s => s.trim());
        for (const stmt of statements) {
          if (stmt.trim()) {
            try { db.exec(stmt); } catch (e) { /* ignore DDL errors like IF NOT EXISTS */ }
          }
        }
        return { rows: [], rowCount: 0 };
      }
    } catch (err) {
      // Ignore "table already exists" errors
      if (err.message && err.message.includes('already exists')) {
        return { rows: [], rowCount: 0 };
      }
      throw err;
    }
  };

  console.log(`📦 Using SQLite (${dbPath})`);
}

function extractTableName(sql) {
  const m = sql.match(/(?:INSERT INTO|UPDATE|DELETE FROM|FROM)\s+(\w+)/i);
  return m ? m[1] : null;
}

module.exports = { query: _query };
