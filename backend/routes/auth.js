const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { usuario, senha, modulo } = req.body;
    if (!usuario || !senha) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    // Find active user with matching username
    const { rows } = await db.query(
      'SELECT * FROM usuarios WHERE usuario = $1 AND ativo = true',
      [usuario]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    const user = rows[0];

    // Check password
    const valid = await bcrypt.compare(senha, user.senha_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }

    // Check if user has access to the requested module
    if (modulo && user.perfil !== 'admin' && user.perfil !== modulo) {
      return res.status(403).json({ error: 'Usuário não tem acesso a este módulo' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, nome: user.nome, usuario: user.usuario, perfil: user.perfil },
      JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      user: { id: user.id, nome: user.nome, usuario: user.usuario, perfil: user.perfil },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/auth/me
const { authMiddleware } = require('../middleware/auth');
router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
