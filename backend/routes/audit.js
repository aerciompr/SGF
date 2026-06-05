const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Helper for generic audits
router.post('/', async (req, res) => {
  try {
    const { acao, detalhes } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await db.query(
      'INSERT INTO auditoria_logs (usuario_id, usuario_nome, acao, detalhes, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [req.user.id, req.user.nome, acao || 'ACAO_DESCONHECIDA', detalhes || '', ip]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Audit log error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
