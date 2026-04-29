const express = require('express');
const db = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/salas?tipo=pericia|audiencia
router.get('/', async (req, res) => {
  try {
    const { tipo } = req.query;
    let query = 'SELECT * FROM salas';
    const values = [];
    if (tipo) {
      query += ' WHERE tipo = $1';
      values.push(tipo);
    }
    query += ' ORDER BY id ASC';
    const { rows } = await db.query(query, values);
    res.json(rows);
  } catch (err) {
    console.error('List salas error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/salas (admin only)
router.post('/', requirePerfil('admin'), async (req, res) => {
  try {
    const { nome, andar, tipo } = req.body;
    if (!nome || !tipo) {
      return res.status(400).json({ error: 'Nome e tipo são obrigatórios' });
    }
    const { rows } = await db.query(
      'INSERT INTO salas (nome, andar, tipo) VALUES ($1, $2, $3) RETURNING *',
      [nome, andar || '', tipo]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create sala error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/salas/:id (admin only)
router.put('/:id', requirePerfil('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, andar, ativo } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (nome !== undefined) { fields.push(`nome = $${idx++}`); values.push(nome); }
    if (andar !== undefined) { fields.push(`andar = $${idx++}`); values.push(andar); }
    if (ativo !== undefined) { fields.push(`ativo = $${idx++}`); values.push(ativo); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const { rows } = await db.query(
      `UPDATE salas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Update sala error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/salas/:id (admin only)
router.delete('/:id', requirePerfil('admin'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM salas WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sala não encontrada' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Delete sala error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
