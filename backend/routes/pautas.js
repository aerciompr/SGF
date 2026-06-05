const express = require('express');
const db = require('../db');
const { authMiddleware, requirePerfil } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const emitUpdate = (req) => {
  const io = req.app.get('io');
  if (io) io.emit('update_audiencias');
};
const emitHistorico = (req) => {
  const io = req.app.get('io');
  if (io) io.emit('update_historico');
};

// GET /api/pautas
router.get('/', async (req, res) => {
  try {
    const { rows: pautas } = await db.query('SELECT * FROM pautas ORDER BY criado_at ASC');
    if (pautas.length === 0) return res.json(pautas);

    const pautasIds = pautas.map(p => p.id);
    const inClausePautas = pautasIds.map((_, i) => `$${i + 1}`).join(',');
    
    const { rows: partes } = await db.query(
      `SELECT * FROM partes WHERE pauta_id IN (${inClausePautas}) ORDER BY ordem ASC`,
      pautasIds
    );

    let testemunhas = [];
    if (partes.length > 0) {
      const partesIds = partes.map(p => p.id);
      const inClausePartes = partesIds.map((_, i) => `$${i + 1}`).join(',');
      const resT = await db.query(
        `SELECT * FROM testemunhas WHERE parte_id IN (${inClausePartes}) ORDER BY ordem ASC`,
        partesIds
      );
      testemunhas = resT.rows;
    }

    const partesMap = {};
    partes.forEach(p => {
      p.testemunhas = [];
      partesMap[p.id] = p;
    });

    testemunhas.forEach(t => {
      if (partesMap[t.parte_id]) {
        partesMap[t.parte_id].testemunhas.push(t);
      }
    });

    const pautasMap = {};
    pautas.forEach(p => {
      p.partes = [];
      pautasMap[p.id] = p;
    });

    partes.forEach(p => {
      if (pautasMap[p.pauta_id]) {
        pautasMap[p.pauta_id].partes.push(p);
      }
    });

    res.json(pautas);
  } catch (err) {
    console.error('List pautas error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// POST /api/pautas (conciliador)
router.post('/', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { processo, sala_id } = req.body;
    if (!processo || !sala_id) {
      return res.status(400).json({ error: 'Processo e sala são obrigatórios' });
    }

    // Get sala name
    const { rows: salas } = await db.query('SELECT nome FROM salas WHERE id = $1', [sala_id]);
    const salaNome = salas.length > 0 ? salas[0].nome : '';

    const { rows } = await db.query(
      'INSERT INTO pautas (processo, sala_id, sala_nome) VALUES ($1, $2, $3) RETURNING *',
      [processo, sala_id, salaNome]
    );
    rows[0].partes = [];
    emitUpdate(req);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create pauta error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/pautas/:id/iniciar
router.put('/:id/iniciar', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE pautas SET status = 'em_andamento' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrada' });
    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/pautas/:id/finalizar
router.put('/:id/finalizar', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE pautas SET status = 'finalizada' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrada' });
    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/pautas/:id
router.delete('/:id', requirePerfil('conciliador'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM pautas WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Não encontrada' });
    emitUpdate(req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ---- Partes ----

// POST /api/pautas/:id/partes
router.post('/:id/partes', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { nome, tipo } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    // Get next order
    const { rows: countRows } = await db.query(
      'SELECT COALESCE(MAX(ordem), 0) + 1 as next_ordem FROM partes WHERE pauta_id = $1',
      [req.params.id]
    );
    const ordem = countRows[0].next_ordem;

    const { rows } = await db.query(
      'INSERT INTO partes (pauta_id, nome, tipo, ordem) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.id, nome, tipo || 'autor', ordem]
    );
    rows[0].testemunhas = [];
    emitUpdate(req);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Add parte error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE /api/pautas/:pautaId/partes/:parteId
router.delete('/:pautaId/partes/:parteId', requirePerfil('conciliador'), async (req, res) => {
  try {
    const result = await db.query('DELETE FROM partes WHERE id = $1 AND pauta_id = $2', [req.params.parteId, req.params.pautaId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Não encontrada' });
    emitUpdate(req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ---- Testemunhas ----

// POST /api/pautas/:id/partes/:parteId/testemunhas
router.post('/:id/partes/:parteId/testemunhas', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const { rows: countRows } = await db.query(
      'SELECT COALESCE(MAX(ordem), 0) + 1 as next_ordem FROM testemunhas WHERE parte_id = $1',
      [req.params.parteId]
    );
    const ordem = countRows[0].next_ordem;

    const { rows } = await db.query(
      'INSERT INTO testemunhas (parte_id, pauta_id, nome, ordem) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.parteId, req.params.id, nome, ordem]
    );
    emitUpdate(req);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Add testemunha error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// DELETE testemunha
router.delete('/:pautaId/partes/:parteId/testemunhas/:testId', requirePerfil('conciliador'), async (req, res) => {
  try {
    await db.query('DELETE FROM testemunhas WHERE id = $1', [req.params.testId]);
    emitUpdate(req);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ---- Status changes for partes/testemunhas ----

// PUT /api/pautas/pessoas/:tipo/:id/chamar
router.put('/pessoas/:tipo/:id/chamar', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { tipo, id } = req.params;
    if (tipo !== 'testemunha' && tipo !== 'parte') return res.status(400).json({ error: 'Tipo inválido' });
    const { sala, processo } = req.body;
    const table = tipo === 'testemunha' ? 'testemunhas' : 'partes';

    const check = await db.query(`SELECT status, nome FROM ${table} WHERE id = $1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    const isAlreadyChamado = check.rows[0].status === 'chamado';

    const { rows } = await db.query(
      `UPDATE ${table} SET status = 'chamado' WHERE id = $1 RETURNING *`,
      [id]
    );

    const tipoChamada = tipo === 'testemunha' ? 'audiencia_testemunha' : 'audiencia_parte';

    if (!isAlreadyChamado) {
      await db.query(
        'INSERT INTO historico_chamadas (nome, sala, tipo, processo) VALUES ($1, $2, $3, $4)',
        [rows[0].nome, sala || '', tipoChamada, processo || '']
      );
      emitHistorico(req);
    } else {
      req.app.get('io').emit('chamar_novamente', { nome: rows[0].nome, sala: sala || '', tipo: tipoChamada, processo: processo || '' });
    }

    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    console.error('Chamar pessoa error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/pautas/pessoas/:tipo/:id/presente
router.put('/pessoas/:tipo/:id/presente', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { tipo, id } = req.params;
    if (tipo !== 'testemunha' && tipo !== 'parte') return res.status(400).json({ error: 'Tipo inválido' });
    const table = tipo === 'testemunha' ? 'testemunhas' : 'partes';
    const { rows } = await db.query(
      `UPDATE ${table} SET status = 'presente' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/pautas/pessoas/:tipo/:id/ausente
router.put('/pessoas/:tipo/:id/ausente', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { tipo, id } = req.params;
    if (tipo !== 'testemunha' && tipo !== 'parte') return res.status(400).json({ error: 'Tipo inválido' });
    const table = tipo === 'testemunha' ? 'testemunhas' : 'partes';
    const { rows } = await db.query(
      `UPDATE ${table} SET status = 'ausente' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /api/pautas/pessoas/:tipo/:id/resetar
router.put('/pessoas/:tipo/:id/resetar', requirePerfil('conciliador'), async (req, res) => {
  try {
    const { tipo, id } = req.params;
    if (tipo !== 'testemunha' && tipo !== 'parte') return res.status(400).json({ error: 'Tipo inválido' });
    const table = tipo === 'testemunha' ? 'testemunhas' : 'partes';
    const { rows } = await db.query(
      `UPDATE ${table} SET status = 'aguardando' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Não encontrado' });
    emitUpdate(req);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

module.exports = router;
