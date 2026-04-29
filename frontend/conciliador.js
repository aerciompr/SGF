/* ========================================
   SGF-JFAL - Conciliador Logic (conciliador.js)
   ======================================== */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const toast = (msg, type) => SGF.showToast($('#toast-container'), msg, type);
  const MODULE = 'conciliador';

  let currentPautaIdForParte = null;
  let currentPautaIdForTest = null;
  let currentParteIdForTest = null;
  let currentSearchTerm = '';
  const collapsedPautas = new Set();

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
    btnOpenDisplay: $('#btn-open-display'),
    formLogin: $('#form-login'),
    loginUsuario: $('#login-usuario'),
    loginSenha: $('#login-senha'),
    loginError: $('#login-error'),
    btnLogout: $('#btn-logout'),
    // Form
    formNovaPauta: $('#form-nova-pauta'),
    inputProcesso: $('#input-processo'),
    selectSalaAudiencia: $('#select-sala-audiencia'),
    // Lists
    listaPautas: $('#lista-pautas'),
    historicoAudiencias: $('#historico-audiencias'),
    // Modal Parte
    modalParte: $('#modal-add-parte'),
    btnCloseParte: $('#btn-close-parte'),
    btnCancelParte: $('#btn-cancel-parte'),
    formAddParte: $('#form-add-parte'),
    inputParteNome: $('#input-parte-nome'),
    selectParteTipo: $('#select-parte-tipo'),
    // Modal Testemunha
    modalTestemunha: $('#modal-add-testemunha'),
    btnCloseTestemunha: $('#btn-close-testemunha'),
    btnCancelTestemunha: $('#btn-cancel-testemunha'),
    formAddTestemunha: $('#form-add-testemunha'),
    inputTestemunhaNome: $('#input-testemunha-nome'),
    // Pautas count
    pautasCount: $('#pautas-count'),
    inputBuscaPautas: $('#input-busca-pautas'),
  };

  // ---- Render Salas ----
  async function renderSalas() {
    const salas = await SGF.getSalas('audiencia');
    if (salas.error) return;
    els.selectSalaAudiencia.innerHTML = '<option value="">-- Selecionar --</option>';
    salas.filter(s => s.ativo).forEach(sala => {
      const opt = document.createElement('option');
      opt.value = sala.id;
      opt.textContent = sala.nome;
      els.selectSalaAudiencia.appendChild(opt);
    });
  }

  // ---- Render Pautas ----
  async function renderPautas() {
    const pautas = await SGF.getPautas();
    if (pautas.error) return;

    let active = pautas.filter(p => p.status !== 'finalizada');

    // Update pautas count
    if (els.pautasCount) els.pautasCount.textContent = active.length;

    // Filter by search term
    if (currentSearchTerm) {
      const term = currentSearchTerm.toLowerCase();
      active = active.filter(p => {
        if (p.processo.toLowerCase().includes(term)) return true;
        for (const parte of (p.partes || [])) {
          if (parte.nome.toLowerCase().includes(term)) return true;
          for (const t of (parte.testemunhas || [])) {
            if (t.nome.toLowerCase().includes(term)) return true;
          }
        }
        return false;
      });
    }

    els.listaPautas.innerHTML = '';

    if (active.length === 0) {
      els.listaPautas.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p>${currentSearchTerm ? 'Nenhuma pauta encontrada na busca' : 'Nenhuma pauta cadastrada'}</p>
          <span>${currentSearchTerm ? 'Tente buscar por outro nome ou processo' : 'Crie uma pauta usando o formulário acima'}</span>
        </div>`;
      return;
    }

    active.forEach(pauta => {
      const card = document.createElement('div');
      card.className = 'pauta-card';
      const statusColor = SGF.STATUS_COLORS[pauta.status];
      const statusLabel = SGF.STATUS_LABELS[pauta.status];

      let partesHtml = '';
      (pauta.partes || []).forEach(parte => {
        const testemunhasHtml = (parte.testemunhas || []).map(t => `
          <div class="testemunha-item">
            <span class="testemunha-label">Testemunha</span>
            <span class="testemunha-nome">${SGF.escapeHtml(t.nome)}</span>
            <span style="color:${SGF.STATUS_COLORS[t.status]};font-size:0.72rem;">${SGF.STATUS_LABELS[t.status]}</span>
            <div style="display:flex;gap:2px;">
              ${t.status === 'aguardando' ? `<button class="btn-icon call" data-chamar-t="${t.id}" data-sala="${pauta.sala_nome}" data-processo="${pauta.processo}" title="Chamar"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg></button>` : ''}
              ${t.status === 'chamado' ? `
                <button class="btn-icon call" data-rechamar-t="${t.id}" data-sala="${pauta.sala_nome}" data-processo="${pauta.processo}" title="Chamar Novamente"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></button>
                <button class="btn-icon" data-presente-t="${t.id}" title="Presente"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
                <button class="btn-icon danger" data-ausente-t="${t.id}" title="Ausente"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
              <button class="btn-icon danger" data-rem-t="${t.id}" data-pauta="${pauta.id}" data-parte="${parte.id}" title="Remover" style="margin-left:2px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
            </div>
          </div>
        `).join('');

        partesHtml += `
          <div class="parte-group">
            <div class="parte-header">
              <div class="parte-header-info">
                <span class="parte-tipo ${parte.tipo}">${parte.tipo === 'autor' ? 'Autor' : 'Réu'}</span>
                <span class="parte-nome">${SGF.escapeHtml(parte.nome)}</span>
                <span style="color:${SGF.STATUS_COLORS[parte.status]};font-size:0.72rem;">${SGF.STATUS_LABELS[parte.status]}</span>
              </div>
              <div style="display:flex;gap:4px;">
                ${parte.status === 'aguardando' ? `<button class="btn-icon call" data-chamar-p="${parte.id}" data-sala="${pauta.sala_nome}" data-processo="${pauta.processo}" title="Chamar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/></svg></button>` : ''}
                ${parte.status === 'chamado' ? `
                  <button class="btn-icon call" data-rechamar-p="${parte.id}" data-sala="${pauta.sala_nome}" data-processo="${pauta.processo}" title="Chamar Novamente"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></button>
                  <button class="btn-icon" data-presente-p="${parte.id}" title="Presente"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></button>
                  <button class="btn-icon danger" data-ausente-p="${parte.id}" title="Ausente"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
                <button class="btn-icon" data-add-test="${parte.id}" data-pauta="${pauta.id}" title="Adicionar testemunha" style="color:var(--primary-400);"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                <button class="btn-icon danger" data-rem-p="${parte.id}" data-pauta="${pauta.id}" title="Remover parte"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg></button>
              </div>
            </div>
            ${testemunhasHtml ? '<div class="testemunha-list">' + testemunhasHtml + '</div>' : ''}
          </div>
        `;
      });

      const isCollapsed = collapsedPautas.has(pauta.id);

      card.innerHTML = `
        <div class="pauta-header">
          <div class="pauta-header-info" style="cursor:pointer;" data-toggle-pauta="${pauta.id}">
            <svg class="chevron ${isCollapsed ? 'collapsed' : ''}" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s; ${isCollapsed ? 'transform: rotate(-90deg);' : ''}"><polyline points="6 9 12 15 18 9"/></svg>
            <div class="pauta-processo">${SGF.escapeHtml(pauta.processo)}</div>
            <div class="pauta-sala">Sala: ${SGF.escapeHtml(pauta.sala_nome || '?')} · <span style="color:${statusColor}">${statusLabel}</span></div>
          </div>
          <div style="display:flex;gap:4px;">
            <button class="btn-icon" data-add-parte="${pauta.id}" title="Adicionar parte" style="color:var(--primary-400);"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg></button>
            ${pauta.status === 'aguardando' ? `<button class="btn btn-primary btn-sm" data-iniciar="${pauta.id}">Iniciar</button>` : ''}
            ${pauta.status === 'em_andamento' ? `<button class="btn btn-secondary btn-sm" data-finalizar="${pauta.id}">Finalizar</button>` : ''}
            <button class="btn-icon danger" data-rem-pauta="${pauta.id}" title="Remover pauta"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        </div>
        <div class="pauta-body" ${isCollapsed ? 'hidden' : ''}>
          ${partesHtml || '<div class="empty-state" style="padding:16px;"><p style="font-size:0.82rem;">Nenhuma parte adicionada</p></div>'}
        </div>
      `;
      els.listaPautas.appendChild(card);
    });

    // Bind all events
    bindPautaEvents();
  }

  function bindPautaEvents() {
    // Add parte
    els.listaPautas.querySelectorAll('[data-add-parte]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPautaIdForParte = parseInt(btn.dataset.addParte);
        els.inputParteNome.value = '';
        els.modalParte.classList.add('active');
      });
    });

    // Iniciar
    els.listaPautas.querySelectorAll('[data-iniciar]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SGF.iniciarAudiencia(parseInt(btn.dataset.iniciar));
        renderPautas();
      });
    });

    // Finalizar
    els.listaPautas.querySelectorAll('[data-finalizar]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SGF.finalizarAudiencia(parseInt(btn.dataset.finalizar));
        renderPautas();
        renderHistorico();
        toast('Audiência finalizada', 'success');
      });
    });

    // Remover pauta
    els.listaPautas.querySelectorAll('[data-rem-pauta]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover esta pauta?')) return;
        await SGF.removerPauta(parseInt(btn.dataset.remPauta));
        renderPautas();
      });
    });

    // Chamar parte
    els.listaPautas.querySelectorAll('[data-chamar-p]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SGF.chamarPessoa('parte', parseInt(btn.dataset.chamarP), btn.dataset.sala, btn.dataset.processo);
        SGF.playNotificationSound();
        renderPautas();
        toast('Parte chamada', 'success');
      });
    });

    // Presente/Ausente parte
    els.listaPautas.querySelectorAll('[data-presente-p]').forEach(btn => {
      btn.addEventListener('click', async () => { await SGF.marcarPresente('parte', parseInt(btn.dataset.presenteP)); renderPautas(); });
    });
    els.listaPautas.querySelectorAll('[data-ausente-p]').forEach(btn => {
      btn.addEventListener('click', async () => { await SGF.marcarAusente('parte', parseInt(btn.dataset.ausenteP)); renderPautas(); });
    });

    // Re-chamar parte
    els.listaPautas.querySelectorAll('[data-rechamar-p]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SGF.chamarPessoa('parte', parseInt(btn.dataset.rechamarP), btn.dataset.sala, btn.dataset.processo);
        SGF.playNotificationSound();
        toast('Parte chamada novamente', 'success');
      });
    });

    // Re-chamar testemunha
    els.listaPautas.querySelectorAll('[data-rechamar-t]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SGF.chamarPessoa('testemunha', parseInt(btn.dataset.rechamarT), btn.dataset.sala, btn.dataset.processo);
        SGF.playNotificationSound();
        toast('Testemunha chamada novamente', 'success');
      });
    });

    // Toggle Accordion
    els.listaPautas.querySelectorAll('[data-toggle-pauta]').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.dataset.togglePauta);
        if (collapsedPautas.has(id)) {
          collapsedPautas.delete(id);
        } else {
          collapsedPautas.add(id);
        }
        renderPautas();
      });
    });

    // Remover parte
    els.listaPautas.querySelectorAll('[data-rem-p]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover esta parte?')) return;
        await SGF.removerParte(parseInt(btn.dataset.pauta), parseInt(btn.dataset.remP));
        renderPautas();
      });
    });

    // Add testemunha
    els.listaPautas.querySelectorAll('[data-add-test]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPautaIdForTest = parseInt(btn.dataset.pauta);
        currentParteIdForTest = parseInt(btn.dataset.addTest);
        els.inputTestemunhaNome.value = '';
        els.modalTestemunha.classList.add('active');
      });
    });

    // Chamar testemunha
    els.listaPautas.querySelectorAll('[data-chamar-t]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SGF.chamarPessoa('testemunha', parseInt(btn.dataset.chamarT), btn.dataset.sala, btn.dataset.processo);
        SGF.playNotificationSound();
        renderPautas();
        toast('Testemunha chamada', 'success');
      });
    });

    // Presente/Ausente testemunha
    els.listaPautas.querySelectorAll('[data-presente-t]').forEach(btn => {
      btn.addEventListener('click', async () => { await SGF.marcarPresente('testemunha', parseInt(btn.dataset.presenteT)); renderPautas(); });
    });
    els.listaPautas.querySelectorAll('[data-ausente-t]').forEach(btn => {
      btn.addEventListener('click', async () => { await SGF.marcarAusente('testemunha', parseInt(btn.dataset.ausenteT)); renderPautas(); });
    });

    // Remover testemunha
    els.listaPautas.querySelectorAll('[data-rem-t]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover testemunha?')) return;
        await SGF.removerTestemunha(parseInt(btn.dataset.pauta), parseInt(btn.dataset.parte), parseInt(btn.dataset.remT));
        renderPautas();
      });
    });
  }

  // ---- Render Histórico ----
  async function renderHistorico() {
    const historico = await SGF.getHistorico();
    if (historico.error) return;
    const filtered = historico.filter(h => h.tipo.startsWith('audiencia_')).slice(0, 20);
    const el = els.historicoAudiencias;
    el.innerHTML = '';
    if (filtered.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>Sem chamadas de audiência ainda</p></div>';
      return;
    }
    filtered.forEach(h => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.style.padding = '8px 12px';
      div.innerHTML = `
        <div class="list-item-info">
          <div class="list-item-name" style="font-size:0.85rem;">${SGF.escapeHtml(h.nome)}</div>
          <div class="list-item-meta">
            <span>→ ${SGF.escapeHtml(h.sala)}</span>
            ${h.processo ? '<span>•</span><span>' + SGF.escapeHtml(h.processo) + '</span>' : ''}
            <span>•</span>
            <span>${SGF.formatTime(h.chamado_at)}</span>
          </div>
        </div>
      `;
      el.appendChild(div);
    });
  }

  // ---- Events ----
  function bindEvents() {
    // Login
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

    // Nova pauta
    els.formNovaPauta.addEventListener('submit', async (e) => {
      e.preventDefault();
      const processo = els.inputProcesso.value.trim();
      const salaId = parseInt(els.selectSalaAudiencia.value);
      if (!processo || !salaId) { toast('Preencha todos os campos', 'error'); return; }
      const result = await SGF.criarPauta(processo, salaId);
      if (result.error) { toast(result.error, 'error'); return; }
      els.inputProcesso.value = '';
      renderPautas();
      toast(`Pauta criada: ${processo}`, 'success');
    });

    // Filtro / Busca
    if (els.inputBuscaPautas) {
      els.inputBuscaPautas.addEventListener('input', (e) => {
        currentSearchTerm = e.target.value.trim();
        renderPautas();
      });
    }

    // Máscara CNJ no Input Processo
    els.inputProcesso.addEventListener('input', function (e) {
      let v = e.target.value.replace(/\D/g, ''); // Remove apenas não-dígitos
      if (v.length > 20) v = v.slice(0, 20);
      
      let out = v;
      if (v.length > 7) out = v.substring(0,7) + '-' + v.substring(7);
      if (v.length > 9) out = out.substring(0,10) + '.' + out.substring(10);
      if (v.length > 13) out = out.substring(0,15) + '.' + out.substring(15);
      if (v.length > 14) out = out.substring(0,17) + '.' + out.substring(17);
      if (v.length > 16) out = out.substring(0,20) + '.' + out.substring(20);
      e.target.value = out;
    });

    // Modal Parte
    const closeParte = () => { els.modalParte.classList.remove('active'); currentPautaIdForParte = null; };
    els.btnCloseParte.addEventListener('click', closeParte);
    if (els.btnCancelParte) els.btnCancelParte.addEventListener('click', closeParte);
    els.formAddParte.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentPautaIdForParte) return;
      const nome = els.inputParteNome.value.trim();
      const tipo = els.selectParteTipo.value;
      if (!nome) return;
      await SGF.addParte(currentPautaIdForParte, nome, tipo);
      closeParte();
      renderPautas();
      toast('Parte adicionada', 'success');
    });

    // Modal Testemunha
    const closeTest = () => { els.modalTestemunha.classList.remove('active'); currentPautaIdForTest = null; currentParteIdForTest = null; };
    els.btnCloseTestemunha.addEventListener('click', closeTest);
    if (els.btnCancelTestemunha) els.btnCancelTestemunha.addEventListener('click', closeTest);
    els.formAddTestemunha.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentPautaIdForTest || !currentParteIdForTest) return;
      const nome = els.inputTestemunhaNome.value.trim();
      if (!nome) return;
      await SGF.addTestemunha(currentPautaIdForTest, currentParteIdForTest, nome);
      closeTest();
      renderPautas();
      toast('Testemunha adicionada', 'success');
    });

    els.btnOpenDisplay.addEventListener('click', () => {
      window.open('display.html', 'sgf_display', 'width=1280,height=720');
    });
  }

  let socketStop = null;

  async function initApp() {
    await renderSalas();
    await renderPautas();
    await renderHistorico();
    
    // Stop any previous listener before starting new one
    if (socketStop) socketStop();
    if (typeof SGF.onSocketEvent !== 'undefined') {
      socketStop = SGF.onSocketEvent('update_audiencias', async () => { renderPautas(); renderHistorico(); });
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
