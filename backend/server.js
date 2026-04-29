const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.set('io', io);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // disable CSP if it blocks static frontend assets
}));
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate Limiting for Auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/salas', require('./routes/salas'));
app.use('/api/periciados', require('./routes/periciados'));
app.use('/api/pautas', require('./routes/pautas'));
app.use('/api/config', require('./routes/config'));
app.use('/api/admin', require('./routes/admin'));

// Authenticated route: list peritos (for recepcao dropdown)
const { authMiddleware } = require('./middleware/auth');
app.get('/api/peritos', authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, nome, usuario FROM usuarios WHERE perfil = 'perito' AND ativo = true ORDER BY nome ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error('List peritos error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});


// Public routes (no auth - for display screen)
app.get('/api/public/historico', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM historico_chamadas ORDER BY chamado_at DESC LIMIT 50');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

app.get('/api/public/youtube', async (req, res) => {
  try {
    const { rows } = await db.query("SELECT valor FROM config WHERE chave = 'youtube_url'");
    res.json({ url: rows.length > 0 ? rows[0].valor : '' });
  } catch (err) { res.status(500).json({ error: 'Erro interno' }); }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---- Database initialization ----
async function initDatabase() {
  try {
    if (process.env.DB_HOST) {
      // PostgreSQL mode: run init.sql
      const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
      await db.query(sql);
    } else {
      // SQLite mode: create tables directly
      const Database = require('better-sqlite3');
      const dbPath = path.join(__dirname, 'sgf_jfal.db');
      const sqliteDb = new Database(dbPath);
      sqliteDb.pragma('journal_mode = WAL');
      sqliteDb.pragma('foreign_keys = ON');

      sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          usuario TEXT UNIQUE NOT NULL,
          senha_hash TEXT NOT NULL,
          perfil TEXT NOT NULL,
          ativo INTEGER DEFAULT 1,
          criado_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS salas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          andar TEXT DEFAULT '',
          tipo TEXT NOT NULL,
          ativo INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS periciados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          cpf TEXT DEFAULT '',
          tipo_pericia TEXT DEFAULT '',
          prioridade TEXT DEFAULT 'normal',
          status TEXT DEFAULT 'aguardando',
          perito_id INTEGER REFERENCES usuarios(id),
          sala_designada TEXT DEFAULT '',
          sala_atendimento TEXT,
          registrado_at TEXT DEFAULT (datetime('now')),
          chegada_at TEXT,
          chamado_at TEXT
        );

        CREATE TABLE IF NOT EXISTS pautas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          processo TEXT NOT NULL,
          sala_id INTEGER REFERENCES salas(id),
          sala_nome TEXT DEFAULT '',
          status TEXT DEFAULT 'aguardando',
          criado_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS partes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pauta_id INTEGER REFERENCES pautas(id) ON DELETE CASCADE,
          nome TEXT NOT NULL,
          tipo TEXT DEFAULT 'autor',
          ordem INTEGER DEFAULT 1,
          status TEXT DEFAULT 'aguardando'
        );

        CREATE TABLE IF NOT EXISTS testemunhas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          parte_id INTEGER REFERENCES partes(id) ON DELETE CASCADE,
          pauta_id INTEGER REFERENCES pautas(id) ON DELETE CASCADE,
          nome TEXT NOT NULL,
          ordem INTEGER DEFAULT 1,
          status TEXT DEFAULT 'aguardando'
        );

        CREATE TABLE IF NOT EXISTS historico_chamadas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome TEXT NOT NULL,
          sala TEXT NOT NULL,
          tipo TEXT NOT NULL,
          processo TEXT DEFAULT '',
          chamado_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS config (
          chave TEXT PRIMARY KEY,
          valor TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS auditoria_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER REFERENCES usuarios(id),
          usuario_nome TEXT,
          acao TEXT NOT NULL,
          detalhes TEXT,
          ip_address TEXT,
          criado_at TEXT DEFAULT (datetime('now'))
        );
      `);

      // Insert default config
      try {
        sqliteDb.prepare("INSERT OR IGNORE INTO config (chave, valor) VALUES ('youtube_url', '')").run();
      } catch (e) { /* ignore */ }

      sqliteDb.close();
    }
    console.log('✓ Database schema initialized');

    // Create default users if none exist
    const { rows } = await db.query('SELECT COUNT(*) as count FROM usuarios');
    if (parseInt(rows[0].count) === 0) {
      const defaults = [
        { nome: 'Administrador', usuario: 'admin', senha: 'admin123', perfil: 'admin' },
        { nome: 'Recepção', usuario: 'recepcao', senha: 'recepcao123', perfil: 'recepcao' },
        { nome: 'Perito', usuario: 'perito', senha: 'perito123', perfil: 'perito' },
        { nome: 'Conciliador', usuario: 'conciliador', senha: 'conciliador123', perfil: 'conciliador' },
      ];

      for (const u of defaults) {
        const hash = await bcrypt.hash(u.senha, 10);
        await db.query(
          'INSERT INTO usuarios (nome, usuario, senha_hash, perfil) VALUES ($1, $2, $3, $4)',
          [u.nome, u.usuario, hash, u.perfil]
        );
      }
      console.log('✓ Default users created');
    }
  } catch (err) {
    console.error('✗ Database init error:', err.message);
    if (process.env.DB_HOST) {
      console.log('Retrying in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      return initDatabase(); // await the retry recursively
    }
    throw err;
  }
}

// Start server
async function start() {
  await initDatabase();
  
  io.on('connection', (socket) => {
    // console.log('Client connected:', socket.id);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ SGF-JFAL Backend running on port ${PORT} with WebSockets`);
  });
}

start();
