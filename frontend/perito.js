/* ========================================
   SGF-JFAL - Perito Logic (perito.js)
   Implements mixed priority algorithm (2:1)
   based on Lei 10.048/2000 best practices.
   ======================================== */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const toast = (msg, type) => SGF.showToast($('#toast-container'), msg, type);
  const MODULE = 'perito';
  const SALA_KEY = 'sgf_perito_sala'; // persists selected room

  // ---- Auth Gate ----
  function checkAuth() {
    if (SGF.isLoggedIn()) {
      if (!SGF.checkModuleAccess(MODULE)) {
        SGF.logout();
        showLogin();
        return;
      }
      showApp();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    $('#login-overlay').style.display = 'flex';
    $('#app-header').hidden = true;
    $('#app-main').hidden = true;
    $('#app-footer').hidden = true;
  }

  function showApp() {
    $('#login-overlay').style.display = 'none';
    $('#app-header').hidden = false;
    $('#app-main').hidden = false;
    $('#app-footer').hidden = false;
    const user = SGF.getLoggedUser();
    $('#user-label').textContent = user ? `Logado como: ${user}` : '';
  }

  const els = {
    clock: $('#page-clock'),
    formLogin: $('#form-login'),
    loginUsuario: $('#login-usuario'),
    loginSenha: $('#login-senha'),
    loginError: $('#login-error'),
    btnLogout: $('#btn-logout'),
    selectSala: $('#select-sala'),
    salaAtual: $('#sala-atual-label'),
    btnTrocarSala: $('#btn-trocar-sala'),
    filaCount: $('#fila-count'),
    filaList: $('#fila-periciados'),
    btnChamarProximo: $('#btn-chamar-proximo'),
    btnOpenDisplay: $('#btn-open-display'),
    historicoLista: $('#historico-lista'),
  };

  // ---- Get logged perito ID ----
  function getPeritoId() {
    const user = SGF.getLoggedUserData();
    return user ? user.id : null;
  }

  // ---- Sala Management ----
  function getSalaSelecionada() {
    return sessionStorage.getItem(SALA_KEY) || '';
  }

  function setSalaSelecionada(sala) {
    sessionStorage.setItem(SALA_KEY, sala);
    updateSalaUI(sala);
  }

  function updateSalaUI(sala) {
    if (els.salaAtual) {
      els.salaAtual.textContent = sala || 'Nenhuma selecionada';
      els.salaAtual.style.color = sala ? 'var(--primary-400)' : 'var(--text-muted)';
    }
    if (els.btnTrocarSala) {
      els.btnTrocarSala.style.display = sala ? 'inline-flex' : 'none';
    }
  }

  // ---- Mixed Priority Algorithm (2:1) ----
  // Based on Lei 10.048/2000: preferential get priority but normals are not fully excluded
  // Pattern: 2 preferential, 1 normal, 2 preferential, 1 normal...
  function applyMixedPriority(fila) {
    const preferenciais = fila.filter(p => p.prioridade === 'preferencial');
    const normais = fila.filter(p => p.prioridade !== 'preferencial');

    // Sort each subgroup by arrival time
    preferenciais.sort((a, b) => new Date(a.chegada_at || 0) - new Date(b.chegada_at || 0));
    normais.sort((a, b) => new Date(a.chegada_at || 0) - new Date(b.chegada_at || 0));

    // Interleave: 2 preferential, 1 normal
    const result = [];
    let pi = 0, ni = 0;

    while (pi < preferenciais.length || ni < normais.length) {
      // Add up to 2 preferenciais
      let prefCount = 0;
      while (prefCount < 2 && pi < preferenciais.length) {
        result.push(preferenciais[pi++]);
        prefCount++;
      }
      // Add 1 normal
      if (ni < normais.length) {
        result.push(normais[ni++]);
      }
      // If no more preferenciais, drain normais
      if (pi >= preferenciais.length) {
        while (ni < normais.length) {
          result.push(normais[ni++]);
        }
      }
    }

    return result;
  }

  // ---- Render Salas ----
  async function renderSalas() {
    const salas = await SGF.getSalas('pericia');
    if (salas.error) return;
    const savedSala = getSalaSelecionada();
    els.selectSala.innerHTML = '<option value="">-- Selecionar Sala --</option>';
    salas.filter(s => s.ativo).forEach(sala => {
      const opt = document.createElement('option');
      opt.value = sala.nome;
      opt.textContent = sala.nome + (sala.andar ? ` (${sala.andar})` : '');
      els.selectSala.appendChild(opt);
    });
    // Restore saved selection
    if (savedSala && [...els.selectSala.options].some(o => o.value === savedSala)) {
      els.selectSala.value = savedSala;
      updateSalaUI(savedSala);
    } else {
      updateSalaUI('');
    }
  }

  // ---- Render Fila ----
  async function renderFila() {
    const peritoId = getPeritoId();
    if (!peritoId) return;

    // Only get periciados assigned to this perito
    const periciados = await SGF.getPericiados(peritoId);
    if (periciados.error) return;

    const salaSelected = getSalaSelecionada() || els.selectSala.value;
    let fila = periciados.filter(p => p.status === 'presente');
    const chamados = periciados.filter(p => p.status === 'chamado');

    // Apply mixed priority algorithm (2:1)
    fila = applyMixedPriority(fila);

    els.filaCount.textContent = fila.length;
    els.btnChamarProximo.disabled = fila.length === 0 || !salaSelected;
    els.filaList.innerHTML = '';

    // --- Queue section ---
    if (fila.length === 0 && chamados.length === 0) {
      els.filaList.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          <p>Nenhum periciado na fila</p>
          <small>Aguardando confirmação de chegada pela recepção</small>
        </div>`;
      return;
    }

    // Render queue (presentes)
    fila.forEach((p, idx) => {
      const div = document.createElement('div');
      div.className = `list-item ${p.prioridade === 'preferencial' ? 'preferencial' : ''}`;
      div.innerHTML = `
        <span style="font-size:1.1rem;font-weight:800;color:var(--primary-400);min-width:28px;text-align:center;">${idx + 1}</span>
        <div class="list-item-info">
          <div class="list-item-name">${SGF.escapeHtml(p.nome)}</div>
          <div class="list-item-meta">
            ${p.tipo_pericia ? '<span>' + SGF.escapeHtml(p.tipo_pericia) + '</span><span>•</span>' : ''}
            <span>${p.prioridade === 'preferencial' ? '★ Preferencial' : 'Normal'}</span>
            <span>•</span>
            <span>Chegou: ${SGF.formatTime(p.chegada_at)}</span>
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-call btn-sm" data-chamar="${p.id}" ${!salaSelected ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            Chamar
          </button>
        </div>
      `;
      els.filaList.appendChild(div);
    });

    // --- Chamados section (people already called, awaiting confirmation) ---
    if (chamados.length > 0) {
      const separator = document.createElement('div');
      separator.style.cssText = 'padding:10px 16px;font-size:0.75rem;font-weight:700;color:var(--warning-400);text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid rgba(255,255,255,0.06);margin-top:8px;display:flex;align-items:center;gap:6px;';
      separator.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        Chamados (${chamados.length})
      `;
      els.filaList.appendChild(separator);

      chamados.forEach(p => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.cssText = 'border-left:3px solid var(--warning-400);background:rgba(245,158,11,0.04);';
        div.innerHTML = `
          <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,0.12);color:var(--warning-400);border-radius:50%;flex-shrink:0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg>
          </div>
          <div class="list-item-info">
            <div class="list-item-name">${SGF.escapeHtml(p.nome)}</div>
            <div class="list-item-meta">
              <span style="color:var(--warning-400);">Chamado</span>
              <span>•</span>
              <span>→ ${SGF.escapeHtml(p.sala_atendimento || '')}</span>
              <span>•</span>
              <span>${SGF.formatTime(p.chamado_at)}</span>
            </div>
          </div>
          <div class="list-item-actions" style="display:flex;gap:4px;flex-wrap:wrap;">
            <button class="btn btn-outline btn-sm" data-rechamar="${p.id}" ${!salaSelected ? 'disabled' : ''} title="Chamar novamente">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
              Chamar novamente
            </button>
            <button class="btn btn-primary btn-sm" data-compareceu="${p.id}" title="Compareceu">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Compareceu
            </button>
            <button class="btn btn-sm" data-nao-compareceu="${p.id}" title="Não compareceu" style="background:rgba(239,68,68,0.15);color:var(--danger-400);border:1px solid rgba(239,68,68,0.3);">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Não compareceu
            </button>
          </div>
        `;
        els.filaList.appendChild(div);
      });
    }

    // --- Bind all events ---

    // Chamar (queue)
    els.filaList.querySelectorAll('[data-chamar]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.chamar);
        const sala = getSalaSelecionada() || els.selectSala.value;
        if (!sala) { toast('Selecione uma sala primeiro', 'error'); return; }
        await SGF.chamarPericiado(id, sala);
        SGF.playNotificationSound();
        renderFila();
        renderHistorico();
        toast(`Chamando periciado → ${sala}`, 'success');
      });
    });

    // Chamar novamente
    els.filaList.querySelectorAll('[data-rechamar]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.rechamar);
        const sala = getSalaSelecionada() || els.selectSala.value;
        if (!sala) { toast('Selecione uma sala primeiro', 'error'); return; }
        await SGF.chamarPericiado(id, sala);
        SGF.playNotificationSound();
        renderFila();
        renderHistorico();
        toast(`Chamando novamente → ${sala}`, 'info');
      });
    });

    // Compareceu
    els.filaList.querySelectorAll('[data-compareceu]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SGF.marcarAtendido(parseInt(btn.dataset.compareceu));
        renderFila();
        toast('Periciado marcado como atendido', 'success');
      });
    });

    // Não compareceu
    els.filaList.querySelectorAll('[data-nao-compareceu]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Confirma que o periciado não compareceu?')) return;
        const id = parseInt(btn.getAttribute('data-nao-compareceu'));
        await SGF.marcarNaoCompareceu(id);
        renderFila();
        toast('Periciado marcado como ausente', 'error');
      });
    });
  }

  // ---- Render Histórico ----
  async function renderHistorico() {
    const historico = await SGF.getHistorico();
    if (historico.error) return;

    const filtered = historico.filter(h => h.tipo === 'pericia').slice(0, 20);
    els.historicoLista.innerHTML = '';

    if (filtered.length === 0) {
      els.historicoLista.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <p>Sem chamadas ainda</p>
        </div>`;
      return;
    }

    filtered.forEach(h => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.style.padding = '8px 12px';
      div.innerHTML = `
        <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:rgba(34,197,94,0.12);color:var(--success-400);border-radius:50%;flex-shrink:0;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="list-item-info">
          <div class="list-item-name" style="font-size:0.85rem;">${SGF.escapeHtml(h.nome)}</div>
          <div class="list-item-meta">
            <span>→ ${SGF.escapeHtml(h.sala)}</span>
            <span>•</span>
            <span>${SGF.formatTime(h.chamado_at)}</span>
          </div>
        </div>
      `;
      els.historicoLista.appendChild(div);
    });
  }

  // ---- Events ----
  function bindEvents() {
    els.formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await SGF.login(MODULE, els.loginUsuario.value.trim(), els.loginSenha.value)) {
        showApp(); initApp();
      } else {
        els.loginError.textContent = 'Usuário ou senha incorretos';
        els.loginError.style.display = 'block';
        els.loginSenha.value = '';
      }
    });

    els.btnLogout.addEventListener('click', () => { SGF.logout(); showLogin(); });

    // Sala selection
    els.selectSala.addEventListener('change', () => {
      const sala = els.selectSala.value;
      if (sala) {
        setSalaSelecionada(sala);
        toast(`Sala definida: ${sala}`, 'success');
      }
      renderFila();
    });

    // Trocar sala button
    if (els.btnTrocarSala) {
      els.btnTrocarSala.addEventListener('click', () => {
        sessionStorage.removeItem(SALA_KEY);
        els.selectSala.value = '';
        updateSalaUI('');
        renderFila();
        toast('Selecione uma nova sala', 'info');
      });
    }

    // Chamar próximo
    els.btnChamarProximo.addEventListener('click', async () => {
      const sala = getSalaSelecionada() || els.selectSala.value;
      if (!sala) { toast('Selecione uma sala primeiro', 'error'); return; }

      const peritoId = getPeritoId();
      if (!peritoId) return;

      const periciados = await SGF.getPericiados(peritoId);
      let fila = periciados.filter(p => p.status === 'presente');
      fila = applyMixedPriority(fila);

      if (fila.length === 0) return;
      await SGF.chamarPericiado(fila[0].id, sala);
      SGF.playNotificationSound();
      renderFila();
      renderHistorico();
      toast(`Chamando ${fila[0].nome} → ${sala}`, 'success');
    });

    els.btnOpenDisplay.addEventListener('click', () => {
      window.open('display.html', 'sgf_display', 'width=1280,height=720');
    });
  }

  let socketStop = null;

  async function initApp() {
    await renderSalas();
    await renderFila();
    await renderHistorico();
    
    // Stop any previous listener before starting new one
    if (socketStop) socketStop();
    if (typeof SGF.onSocketEvent !== 'undefined') {
      socketStop = SGF.onSocketEvent('update_pericias', async () => { renderFila(); renderHistorico(); });
    }
  }

  function init() {
    bindEvents();
    SGF.updateClock(els.clock);
    setInterval(() => SGF.updateClock(els.clock), 1000);
    checkAuth();
    if (SGF.isLoggedIn() && SGF.checkModuleAccess(MODULE)) { initApp(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
