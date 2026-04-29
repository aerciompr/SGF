const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();

// All routes require admin
router.use(authMiddleware, requirePerfil('admin'));

// GET /api/usuarios
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, nome, usuario, perfil, ativo, criado_at FROM usuarios ORDER BY criado_at ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/usuarios
router.post('/', async (req, res) => {
  try {
    const { nome, usuario, senha, perfil } = req.body;
    if (!nome || !usuario || !senha || !perfil) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    const validPerfis = ['admin', 'recepcao', 'perito', 'conciliador'];
    if (!validPerfis.includes(perfil)) {
      return res.status(400).json({ error: 'Perfil inválido' });
    }

    // Check if username already exists
    const existing = await db.query('SELECT id FROM usuarios WHERE usuario = $1', [usuario]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Nome de usuário já existe' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await db.query(
      'INSERT INTO usuarios (nome, usuario, senha_hash, perfil) VALUES ($1, $2, $3, $4) RETURNING id, nome, usuario, perfil, ativo, criado_at',
      [nome, usuario, hash, perfil]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, usuario, senha, perfil, ativo } = req.body;

    // Build dynamic update
    const fields = [];
    const values = [];
    let idx = 1;

    if (nome !== undefined) { fields.push(`nome = $${idx++}`); values.push(nome); }
    if (usuario !== undefined) {
      // Check uniqueness
      const existing = await db.query('SELECT id FROM usuarios WHERE usuario = $1 AND id != $2', [usuario, id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Nome de usuário já existe' });
      }
      fields.push(`usuario = $${idx++}`); values.push(usuario);
    }
    if (senha) {
      const hash = await bcrypt.hash(senha, 10);
      fields.push(`senha_hash = $${idx++}`); values.push(hash);
    }
    if (perfil !== undefined) { fields.push(`perfil = $${idx++}`); values.push(perfil); }
    if (ativo !== undefined) { fields.push(`ativo = $${idx++}`); values.push(ativo); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(id);
    const { rows } = await db.query(
      `UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nome, usuario, perfil, ativo, criado_at`,
      values
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/usuarios/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Não é possível remover o próprio usuário' });
    }

    const result = await db.query('DELETE FROM usuarios WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
