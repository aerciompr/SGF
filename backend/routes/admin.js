const express = require('express');
const db = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');
const fs = require('fs');

const router = express.Router();
router.use(authMiddleware);
router.use(requirePerfil('admin'));

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM auditoria_logs ORDER BY criado_at DESC LIMIT 100');
    res.json(rows);
  } catch (err) {
    console.error('Dashboard logs error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/admin/auditoria/csv
router.get('/auditoria/csv', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM auditoria_logs ORDER BY criado_at DESC');
    
    // Convert to CSV
    let csv = 'ID,Data/Hora,Usuário ID,Usuário Nome,Ação,Detalhes,IP\n';
    
    const sanitizeCsvField = (field) => {
      let str = String(field || '');
      if (/^[=+\-@]/.test(str)) {
        str = "'" + str;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    rows.forEach(r => {
      const dataStr = new Date(r.criado_at).toLocaleString('pt-BR');
      const usrNome = sanitizeCsvField(r.usuario_nome);
      const acao = sanitizeCsvField(r.acao);
      const detalhes = sanitizeCsvField(r.detalhes);
      csv += `${r.id},${dataStr},${r.usuario_id || ''},${usrNome},${acao},${detalhes},${r.ip_address || ''}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auditoria_logs.csv"');
    res.status(200).send(Buffer.from(csv, 'utf8'));
  } catch (err) {
    console.error('Export CSV error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
