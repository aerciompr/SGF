/* ========================================
   SGF-JFAL - Recepção Logic (recepcao.js)
   ======================================== */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const toast = (msg, type) => SGF.showToast($('#toast-container'), msg, type);
  const MODULE = 'recepcao';

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
    // Form
    formRegistro: $('#form-registro'),
    inputNome: $('#input-nome'),
    inputCpf: $('#input-cpf'),
    selectTipoPericia: $('#select-tipo-pericia'),
    selectPerito: $('#select-perito'),
    selectSalaDesignada: $('#select-sala-designada'),
    // YouTube
    inputYoutube: $('#input-youtube-url'),
    btnSaveYoutube: $('#btn-save-youtube'),
    btnClearYoutube: $('#btn-clear-youtube'),
    // List
    filtroPerito: $('#filtro-perito'),
    inputBusca: $('#input-busca'),
    listaPericiados: $('#lista-periciados'),
    periCount: $('#peri-count'),
  };

  // ---- Render Peritos Dropdown ----
  let peritosCache = [];

  async function renderPeritosDropdown() {
    const peritos = await SGF.getPeritos();
    if (peritos.error) return;
    peritosCache = peritos;

    // Dropdown no formulário
    els.selectPerito.innerHTML = '<option value="">-- Selecionar Perito --</option>';
    peritos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nome;
      els.selectPerito.appendChild(opt);
    });

    // Dropdown de filtro na lista
    els.filtroPerito.innerHTML = '<option value="">Todos os peritos</option>';
    peritos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nome;
      els.filtroPerito.appendChild(opt);
    });
  }

  // ---- Render Salas ----
  async function renderSalasSelect() {
    const salas = await SGF.getSalas('pericia');
    if (salas.error) return;
    els.selectSalaDesignada.innerHTML = '<option value="">-- Sem designação --</option>';
    salas.filter(s => s.ativo).forEach(sala => {
      const opt = document.createElement('option');
      opt.value = sala.nome;
      opt.textContent = sala.nome;
      els.selectSalaDesignada.appendChild(opt);
    });
  }

  // ---- Render Lista ----
  async function renderLista() {
    const periciados = await SGF.getPericiados();
    if (periciados.error) return;

    const busca = els.inputBusca.value.trim().toLowerCase();
    const filtroPerito = els.filtroPerito.value;
    let lista = periciados;

    // Filtrar por perito
    if (filtroPerito) {
      lista = lista.filter(p => String(p.perito_id) === filtroPerito);
    }

    // Filtrar por busca
    if (busca) {
      lista = lista.filter(p => p.nome.toLowerCase().includes(busca) || (p.cpf && p.cpf.includes(busca)));
    }

    // Sort: aguardando first, then presente, then chamado/atendido
    const statusOrder = { aguardando: 0, presente: 1, chamado: 2, atendido: 3, ausente: 4 };
    lista.sort((a, b) => (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0));

    els.periCount.textContent = lista.length;
    els.listaPericiados.innerHTML = '';

    if (lista.length === 0) {
      els.listaPericiados.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p>Nenhum periciado registrado</p>
          <span>Registre um periciado usando o formulário ao lado</span>
        </div>`;
      return;
    }

    lista.forEach(p => {
      const div = document.createElement('div');
      div.className = `list-item ${p.prioridade === 'preferencial' ? 'preferencial' : ''}`;
      const statusColor = SGF.STATUS_COLORS[p.status] || 'var(--text-muted)';
      const statusLabel = SGF.STATUS_LABELS[p.status] || p.status;
      const peritoNome = p.perito_nome || 'N/A';
      div.innerHTML = `
        <div class="list-item-info">
          <div class="list-item-name">${SGF.escapeHtml(p.nome)}</div>
          <div class="list-item-meta">
            ${p.cpf ? '<span>' + SGF.escapeHtml(p.cpf) + '</span><span>•</span>' : ''}
            <span style="color:${statusColor}">${statusLabel}</span>
            <span>•</span>
            <span>${p.prioridade === 'preferencial' ? '★ Preferencial' : 'Normal'}</span>
            <span>•</span>
            <span style="color:var(--accent-400);">Perito: ${SGF.escapeHtml(peritoNome)}</span>
            ${p.sala_designada ? '<span>•</span><span>→ ' + SGF.escapeHtml(p.sala_designada) + '</span>' : ''}
          </div>
        </div>
        <div class="list-item-actions">
          ${p.status === 'aguardando' ? `
            <button class="btn btn-primary btn-sm" data-chegada="${p.id}" title="Confirmar chegada">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Chegou
            </button>
          ` : ''}
          <button class="btn-icon danger" data-remove="${p.id}" title="Remover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      els.listaPericiados.appendChild(div);
    });

    // Bind actions
    els.listaPericiados.querySelectorAll('[data-chegada]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await SGF.confirmarChegada(parseInt(btn.dataset.chegada));
        toast('Chegada confirmada', 'success');
        renderLista();
      });
    });

    els.listaPericiados.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover este periciado?')) return;
        await SGF.removerPericiado(parseInt(btn.dataset.remove));
        toast('Periciado removido', 'info');
        renderLista();
      });
    });
  }

  // ---- Events ----
  function bindEvents() {
    // Login
    els.formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = els.loginUsuario.value.trim();
      const pass = els.loginSenha.value;
      if (await SGF.login(MODULE, user, pass)) {
        showApp();
        initApp();
      } else {
        els.loginError.textContent = 'Usuário ou senha incorretos';
        els.loginError.style.display = 'block';
        els.loginSenha.value = '';
        els.loginSenha.focus();
      }
    });

    els.btnLogout.addEventListener('click', () => {
      SGF.logout();
      showLogin();
    });

    // Registro
    els.formRegistro.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = els.inputNome.value.trim();
      if (!nome) { toast('Informe o nome', 'error'); return; }

      const peritoId = els.selectPerito.value;
      if (!peritoId) { toast('Selecione o perito responsável', 'error'); return; }

      const dados = {
        nome,
        cpf: els.inputCpf.value.trim(),
        tipo_pericia: els.selectTipoPericia.value,
        prioridade: document.querySelector('input[name="prioridade"]:checked')?.value || 'normal',
        perito_id: parseInt(peritoId),
        sala_designada: els.selectSalaDesignada.value,
      };

      const result = await SGF.addPericiado(dados);
      if (result.error) { toast(result.error, 'error'); return; }

      els.formRegistro.reset();
      renderLista();
      toast(`${nome} registrado`, 'success');
    });

    // CPF mask
    els.inputCpf.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 9) {
        v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
      } else if (v.length > 6) {
        v = v.replace(/^(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
      } else if (v.length > 3) {
        v = v.replace(/^(\d{3})(\d{1,3})/, '$1.$2');
      }
      e.target.value = v;
    });

    // Filtros
    els.inputBusca.addEventListener('input', renderLista);
    els.filtroPerito.addEventListener('change', renderLista);

    // YouTube
    els.btnSaveYoutube.addEventListener('click', async () => {
      await SGF.setYoutubeUrl(els.inputYoutube.value.trim());
      toast('URL do YouTube atualizada', 'success');
    });

    els.btnClearYoutube.addEventListener('click', async () => {
      els.inputYoutube.value = '';
      await SGF.setYoutubeUrl('');
      toast('URL do YouTube removida', 'info');
    });
  }

  async function loadYoutube() {
    const url = await SGF.getYoutubeUrl();
    els.inputYoutube.value = url || '';
  }

  let socketStop = null;

  async function initApp() {
    await renderPeritosDropdown();
    await renderSalasSelect();
    await renderLista();
    await loadYoutube();
    
    // Stop any previous listener before starting new one
    if (socketStop) socketStop();
    if (typeof SGF.onSocketEvent !== 'undefined') {
      socketStop = SGF.onSocketEvent('update_pericias', renderLista);
    }
  }

  function init() {
    bindEvents();
    SGF.updateClock(els.clock);
    setInterval(() => SGF.updateClock(els.clock), 1000);
    checkAuth();
    if (SGF.isLoggedIn() && SGF.checkModuleAccess(MODULE)) {
      initApp();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
