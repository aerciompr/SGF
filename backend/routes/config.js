const express = require('express');
const db = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/config/youtube
router.get('/youtube', async (req, res) => {
  try {
    const { rows } = await db.query("SELECT valor FROM config WHERE chave = 'youtube_url'");
    res.json({ url: rows.length > 0 ? rows[0].valor : '' });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/config/youtube (admin or recepcao)
router.put('/youtube', requirePerfil('admin', 'recepcao'), async (req, res) => {
  try {
    const { url } = req.body;
    await db.query(
      `INSERT INTO config (chave, valor) VALUES ('youtube_url', $1)
       ON CONFLICT (chave) DO UPDATE SET valor = $1`,
      [url || '']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/config/historico
router.get('/historico', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM historico_chamadas ORDER BY chamado_at DESC LIMIT 50'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/config/historico (admin only)
router.delete('/historico', requirePerfil('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM historico_chamadas');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/config/stats
router.get('/stats', async (req, res) => {
  try {
    const [periciados, pautas, historico, usuarios] = await Promise.all([
      db.query(`SELECT COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'presente' THEN 1 ELSE 0 END), 0) as fila,
        COALESCE(SUM(CASE WHEN status = 'atendido' THEN 1 ELSE 0 END), 0) as atendidos
        FROM periciados`),
      db.query(`SELECT COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'em_andamento' THEN 1 ELSE 0 END), 0) as em_andamento
        FROM pautas`),
      db.query('SELECT COUNT(*) as total FROM historico_chamadas'),
      db.query('SELECT COUNT(*) as total FROM usuarios WHERE ativo = true'),
    ]);

    res.json({
      periciados: periciados.rows[0],
      pautas: pautas.rows[0],
      historico: historico.rows[0],
      usuarios: usuarios.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/config/chamada-ativa (for display - no auth needed)
// We keep this separate - see below

module.exports = router;
