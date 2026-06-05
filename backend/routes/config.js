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
    req.app.get('io').emit('youtube_update', { url: url || '' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/config/tts
router.get('/tts', async (req, res) => {
  try {
    const { rows } = await db.query("SELECT chave, valor FROM config WHERE chave IN ('tts_voice_uri', 'tts_rate', 'tts_pitch')");
    const tts = { uri: '', rate: 1, pitch: 1 };
    rows.forEach(r => {
      if (r.chave === 'tts_voice_uri') tts.uri = r.valor;
      if (r.chave === 'tts_rate') tts.rate = parseFloat(r.valor) || 1;
      if (r.chave === 'tts_pitch') tts.pitch = parseFloat(r.valor) || 1;
    });
    res.json(tts);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/config/tts (admin only)
router.put('/tts', requirePerfil('admin'), async (req, res) => {
  try {
    const { uri, rate, pitch } = req.body;
    await db.query(
      `INSERT INTO config (chave, valor) VALUES ('tts_voice_uri', $1)
       ON CONFLICT (chave) DO UPDATE SET valor = $1`,
      [uri || '']
    );
    await db.query(
      `INSERT INTO config (chave, valor) VALUES ('tts_rate', $1)
       ON CONFLICT (chave) DO UPDATE SET valor = $1`,
      [rate != null ? rate.toString() : '1']
    );
    await db.query(
      `INSERT INTO config (chave, valor) VALUES ('tts_pitch', $1)
       ON CONFLICT (chave) DO UPDATE SET valor = $1`,
      [pitch != null ? pitch.toString() : '1']
    );
    req.app.get('io').emit('tts_update', { uri, rate, pitch });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/config/historico
router.get('/historico', async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM historico_chamadas WHERE date(chamado_at, 'localtime') = date('now', 'localtime') ORDER BY chamado_at DESC LIMIT 50"
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
