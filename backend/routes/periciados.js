const express = require('express');
const db = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const emitUpdate = (req) => {
  const io = req.app.get('io');
  if (io) io.emit('update_pericias');
};
const emitHistorico = (req) => {
  const io = req.app.get('io');
  if (io) io.emit('update_historico');
};

// GET /api/periciados?perito_id=X
router.get('/', async (req, res) => {
  try {
    const { perito_id } = req.query;
    let query = `
      SELECT p.*, u.nome as perito_nome
      FROM periciados p
      LEFT JOIN usuarios u ON p.perito_id = u.id
    `;
    const values = [];
    if (perito_id) {
      query += ' WHERE p.perito_id = $1';
      values.push(perito_id);
    }
    query += ' ORDER BY p.registrado_at ASC';
    const { rows } = await db.query(query, values);
    res.json(rows);
  } catch (err) {
    console.error('List periciados error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/periciados (recepcao) — perito_id obrigatório
router.post('/', requirePerfil('recepcao'), async (req, res) => {
  try {
    const { nome, cpf, tipo_pericia, prioridade, perito_id, sala_designada } = req.body;
    if (!nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    if (!perito_id) {
      return res.status(400).json({ error: 'Perito responsável é obrigatório' });
    }
    const { rows } = await db.query(
      `INSERT INTO periciados (nome, cpf, tipo_pericia, prioridade, perito_id, sala_designada)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nome, cpf || '', tipo_pericia || '', prioridade || 'normal', perito_id, sala_designada || '']
    );
    emitUpdate(req);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create periciado error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/periciados/:id/chegada (recepcao)
router.put('/:id/chegada', requirePerfil('recepcao'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE periciados SET status = 'presente', chegada_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    console.error('Chegada error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/periciados/:id/chamar (perito)
router.put('/:id/chamar', requirePerfil('perito'), async (req, res) => {
  try {
    const { sala } = req.body;
    if (!sala) return res.status(400).json({ error: 'Sala é obrigatória' });

    // Verify current status to decide whether to insert in history
    const check = await db.query('SELECT status, nome FROM periciados WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    const isAlreadyChamado = check.rows[0].status === 'chamado';

    const { rows } = await db.query(
      `UPDATE periciados SET status = 'chamado', sala_atendimento = $1, chamado_at = NOW()
       WHERE id = $2 RETURNING *`,
      [sala, req.params.id]
    );

    if (!isAlreadyChamado) {
      await db.query(
        `INSERT INTO historico_chamadas (nome, sala, tipo) VALUES ($1, $2, 'pericia')`,
        [rows[0].nome, sala]
      );
      emitHistorico(req);
    } else {
      req.app.get('io').emit('chamar_novamente', { nome: rows[0].nome, sala, tipo: 'pericia' });
    }

    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    console.error('Chamar error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/periciados/:id/atendido (perito) — compareceu
router.put('/:id/atendido', requirePerfil('perito'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE periciados SET status = 'atendido' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    console.error('Atendido error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/periciados/:id/nao-compareceu (perito) — não compareceu
router.put('/:id/nao-compareceu', requirePerfil('perito'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE periciados SET status = 'ausente' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    console.error('Nao compareceu error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/periciados/:id
router.delete('/:id', requirePerfil('recepcao'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM periciados WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Não encontrado' });
    emitUpdate(req);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete periciado error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/periciados (admin - clear all)
router.delete('/', requirePerfil('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM periciados');
    emitUpdate(req);
    res.json({ success: true });
  } catch (err) {
    console.error('Clear periciados error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
