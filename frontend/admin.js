/* ========================================
   SGF-JFAL - Admin Logic (admin.js)
   ======================================== */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const toast = (msg, type) => SGF.showToast($('#toast-container'), msg, type);
  const MODULE = 'admin';

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
    // Login
    formLogin: $('#form-login'),
    loginUsuario: $('#login-usuario'),
    loginSenha: $('#login-senha'),
    loginError: $('#login-error'),
    btnLogout: $('#btn-logout'),
    // Salas Pericia
    formSalaPericia: $('#form-sala-pericia'),
    inputSalaPericiaName: $('#input-sala-pericia-name'),
    inputSalaPericiaAndar: $('#input-sala-pericia-andar'),
    listaSalasPericia: $('#lista-salas-pericia'),
    // Salas Audiencia
    formSalaAudiencia: $('#form-sala-audiencia'),
    inputSalaAudienciaName: $('#input-sala-audiencia-name'),
    inputSalaAudienciaAndar: $('#input-sala-audiencia-andar'),
    listaSalasAudiencia: $('#lista-salas-audiencia'),
    // YouTube
    inputYoutube: $('#input-youtube-url'),
    btnSaveYoutube: $('#btn-save-youtube'),
    btnClearYoutube: $('#btn-clear-youtube'),
    // Usuarios
    formNovoUsuario: $('#form-novo-usuario'),
    inputUsuarioNome: $('#input-usuario-nome'),
    inputUsuarioLogin: $('#input-usuario-login'),
    inputUsuarioSenha: $('#input-usuario-senha'),
    selectUsuarioPerfil: $('#select-usuario-perfil'),
    listaUsuarios: $('#lista-usuarios'),
    // Modal Editar Usuario
    modalEditUsuario: $('#modal-edit-usuario'),
    btnCloseModalEdit: $('#btn-close-modal-edit'),
    btnCancelModalEdit: $('#btn-cancel-modal-edit'),
    formEditUsuario: $('#form-edit-usuario'),
    editUsuarioId: $('#edit-usuario-id'),
    editUsuarioNome: $('#edit-usuario-nome'),
    editUsuarioLogin: $('#edit-usuario-login'),
    editUsuarioSenha: $('#edit-usuario-senha'),
    selectEditPerfil: $('#select-edit-perfil'),
    checkEditAtivo: $('#check-edit-ativo'),
    // Actions
    btnLimparHistorico: $('#btn-limpar-historico'),
    btnLimparPericiados: $('#btn-limpar-periciados'),
    btnResetTudo: $('#btn-reset-tudo'),
    // Stats
    statsBody: $('#stats-body'),
  };

  // ---- Render Salas ----
  async function renderSalasPericia() {
    const salas = await SGF.getSalas('pericia');
    if (salas.error) return;
    els.listaSalasPericia.innerHTML = '';
    if (salas.length === 0) {
      els.listaSalasPericia.innerHTML = '<div class="empty-state"><p>Nenhuma sala cadastrada</p></div>';
      return;
    }
    salas.forEach(sala => {
      const div = document.createElement('div');
      div.className = `room-item ${sala.ativo ? '' : 'inactive'}`;
      div.innerHTML = `
        <span class="room-name">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          ${SGF.escapeHtml(sala.nome)}${sala.andar ? ' <small style="color:var(--text-muted);">(' + SGF.escapeHtml(sala.andar) + ')</small>' : ''}
        </span>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon ${sala.ativo ? '' : 'danger'}" data-toggle="${sala.id}" data-ativo="${sala.ativo}" title="${sala.ativo ? 'Desativar' : 'Ativar'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${sala.ativo ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}</svg>
          </button>
          <button class="btn-icon danger" data-remove="${sala.id}" title="Remover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      els.listaSalasPericia.appendChild(div);
    });
    // Bind events
    els.listaSalasPericia.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ativo = btn.dataset.ativo === 'true';
        await SGF.toggleSala(parseInt(btn.dataset.toggle), !ativo);
        renderSalasPericia();
      });
    });
    els.listaSalasPericia.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover esta sala?')) return;
        await SGF.removeSala(parseInt(btn.dataset.remove));
        renderSalasPericia();
        toast('Sala removida', 'info');
      });
    });
  }

  async function renderSalasAudiencia() {
    const salas = await SGF.getSalas('audiencia');
    if (salas.error) return;
    els.listaSalasAudiencia.innerHTML = '';
    if (salas.length === 0) {
      els.listaSalasAudiencia.innerHTML = '<div class="empty-state"><p>Nenhuma sala cadastrada</p></div>';
      return;
    }
    salas.forEach(sala => {
      const div = document.createElement('div');
      div.className = `room-item ${sala.ativo ? '' : 'inactive'}`;
      div.innerHTML = `
        <span class="room-name">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          ${SGF.escapeHtml(sala.nome)}${sala.andar ? ' <small style="color:var(--text-muted);">(' + SGF.escapeHtml(sala.andar) + ')</small>' : ''}
        </span>
        <div style="display:flex;gap:4px;">
          <button class="btn-icon ${sala.ativo ? '' : 'danger'}" data-toggle="${sala.id}" data-ativo="${sala.ativo}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${sala.ativo ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>' : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}</svg>
          </button>
          <button class="btn-icon danger" data-remove="${sala.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      els.listaSalasAudiencia.appendChild(div);
    });
    els.listaSalasAudiencia.querySelectorAll('[data-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ativo = btn.dataset.ativo === 'true';
        await SGF.toggleSala(parseInt(btn.dataset.toggle), !ativo);
        renderSalasAudiencia();
      });
    });
    els.listaSalasAudiencia.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover esta sala?')) return;
        await SGF.removeSala(parseInt(btn.dataset.remove));
        renderSalasAudiencia();
        toast('Sala removida', 'info');
      });
    });
  }

  // ---- Render Usuarios ----
  const PERFIL_LABELS = { admin: 'Administrador', recepcao: 'Recepção', perito: 'Perito', conciliador: 'Conciliador' };
  const PERFIL_COLORS = { admin: 'var(--danger-400)', recepcao: 'var(--primary-400)', perito: 'var(--accent-400)', conciliador: 'var(--warning-400)' };

  async function renderUsuarios() {
    const usuarios = await SGF.getUsuarios();
    if (usuarios.error) return;
    els.listaUsuarios.innerHTML = '';
    if (usuarios.length === 0) {
      els.listaUsuarios.innerHTML = '<div class="empty-state"><p>Nenhum usuário cadastrado</p></div>';
      return;
    }
    usuarios.forEach(u => {
      const div = document.createElement('div');
      div.className = `list-item ${u.ativo ? '' : 'inactive'}`;
      div.style.cssText = u.ativo ? '' : 'opacity:0.5;';
      div.innerHTML = `
        <div class="list-item-info" style="flex:1;">
          <div class="list-item-name">${SGF.escapeHtml(u.nome)}</div>
          <div class="list-item-meta">
            <span>Login: ${SGF.escapeHtml(u.usuario)}</span>
            <span>•</span>
            <span style="color:${PERFIL_COLORS[u.perfil] || 'var(--text-muted)'}">${PERFIL_LABELS[u.perfil] || u.perfil}</span>
            ${!u.ativo ? '<span>•</span><span style="color:var(--danger-400);">Inativo</span>' : ''}
          </div>
        </div>
        <div class="list-item-actions" style="display:flex;gap:4px;">
          <button class="btn-icon" data-edit='${JSON.stringify({id:u.id,nome:u.nome,usuario:u.usuario,perfil:u.perfil,ativo:u.ativo})}' title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" data-delete="${u.id}" title="Remover">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
      els.listaUsuarios.appendChild(div);
    });

    // Bind edit
    els.listaUsuarios.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const u = JSON.parse(btn.dataset.edit);
        els.editUsuarioId.value = u.id;
        els.editUsuarioNome.value = u.nome;
        els.editUsuarioLogin.value = u.usuario;
        els.editUsuarioSenha.value = '';
        els.selectEditPerfil.value = u.perfil;
        els.checkEditAtivo.checked = u.ativo;
        els.modalEditUsuario.classList.add('active');
      });
    });

    // Bind delete
    els.listaUsuarios.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover este usuário?')) return;
        const result = await SGF.removeUsuario(parseInt(btn.dataset.delete));
        if (result.error) { toast(result.error, 'error'); return; }
        toast('Usuário removido', 'info');
        renderUsuarios();
      });
    });
  }

  // ---- Stats ----
  async function renderStats() {
    const stats = await SGF.getStats();
    if (stats.error) return;
    els.statsBody.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        <div style="text-align:center;padding:12px;background:rgba(33,150,212,0.08);border-radius:var(--radius-sm);">
          <div style="font-size:1.6rem;font-weight:800;color:var(--primary-400);">${stats.periciados?.fila || 0}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Na fila</div>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(34,197,94,0.08);border-radius:var(--radius-sm);">
          <div style="font-size:1.6rem;font-weight:800;color:var(--accent-400);">${stats.periciados?.atendidos || 0}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Atendidos</div>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(245,158,11,0.08);border-radius:var(--radius-sm);">
          <div style="font-size:1.6rem;font-weight:800;color:var(--warning-400);">${stats.pautas?.em_andamento || 0}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Audiências ativas</div>
        </div>
        <div style="text-align:center;padding:12px;background:rgba(139,92,246,0.08);border-radius:var(--radius-sm);">
          <div style="font-size:1.6rem;font-weight:800;color:var(--blue-400);">${stats.usuarios?.total || 0}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;">Usuários ativos</div>
        </div>
      </div>
    `;
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

    // Logout
    els.btnLogout.addEventListener('click', () => {
      SGF.logout();
      showLogin();
      els.loginUsuario.value = '';
      els.loginSenha.value = '';
      els.loginError.style.display = 'none';
    });

    // Salas Pericia
    els.formSalaPericia.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = els.inputSalaPericiaName.value.trim();
      const andar = els.inputSalaPericiaAndar.value.trim();
      if (!nome) return;
      const result = await SGF.addSala(nome, andar, 'pericia');
      if (result.error) { toast(result.error, 'error'); return; }
      els.inputSalaPericiaName.value = '';
      els.inputSalaPericiaAndar.value = '';
      renderSalasPericia();
      toast('Sala adicionada', 'success');
    });

    // Salas Audiencia
    els.formSalaAudiencia.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nome = els.inputSalaAudienciaName.value.trim();
      const andar = els.inputSalaAudienciaAndar.value.trim();
      if (!nome) return;
      const result = await SGF.addSala(nome, andar, 'audiencia');
      if (result.error) { toast(result.error, 'error'); return; }
      els.inputSalaAudienciaName.value = '';
      els.inputSalaAudienciaAndar.value = '';
      renderSalasAudiencia();
      toast('Sala adicionada', 'success');
    });

    // YouTube
    els.btnSaveYoutube.addEventListener('click', async () => {
      const url = els.inputYoutube.value.trim();
      await SGF.setYoutubeUrl(url);
      updateYoutubePreview(url);
      toast('URL do YouTube atualizada', 'success');
    });

    els.btnClearYoutube.addEventListener('click', async () => {
      els.inputYoutube.value = '';
      await SGF.setYoutubeUrl('');
      updateYoutubePreview('');
      toast('URL do YouTube removida', 'info');
    });

    // Live YouTube preview on input
    els.inputYoutube.addEventListener('input', () => {
      updateYoutubePreview(els.inputYoutube.value.trim());
    });

    // Novo Usuario
    els.formNovoUsuario.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = {
        nome: els.inputUsuarioNome.value.trim(),
        usuario: els.inputUsuarioLogin.value.trim(),
        senha: els.inputUsuarioSenha.value,
        perfil: els.selectUsuarioPerfil.value,
      };
      if (!dados.nome || !dados.usuario || !dados.senha) {
        toast('Preencha todos os campos', 'error');
        return;
      }
      const result = await SGF.addUsuario(dados);
      if (result.error) { toast(result.error, 'error'); return; }
      els.inputUsuarioNome.value = '';
      els.inputUsuarioLogin.value = '';
      els.inputUsuarioSenha.value = '';
      renderUsuarios();
      toast('Usuário criado com sucesso', 'success');
    });

    // Edit Usuario Modal
    const closeEditModal = () => els.modalEditUsuario.classList.remove('active');
    els.btnCloseModalEdit.addEventListener('click', closeEditModal);
    els.btnCancelModalEdit.addEventListener('click', closeEditModal);

    els.formEditUsuario.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = parseInt(els.editUsuarioId.value);
      const dados = {
        nome: els.editUsuarioNome.value.trim(),
        usuario: els.editUsuarioLogin.value.trim(),
        perfil: els.selectEditPerfil.value,
        ativo: els.checkEditAtivo.checked,
      };
      const senha = els.editUsuarioSenha.value;
      if (senha) dados.senha = senha;

      const result = await SGF.updateUsuario(id, dados);
      if (result.error) { toast(result.error, 'error'); return; }
      closeEditModal();
      renderUsuarios();
      toast('Usuário atualizado', 'success');
    });

    // Actions
    els.btnLimparHistorico.addEventListener('click', async () => {
      if (!confirm('Tem certeza que deseja limpar o histórico de chamadas?')) return;
      await SGF.limparHistorico();
      renderStats();
      toast('Histórico limpo', 'info');
    });

    els.btnLimparPericiados.addEventListener('click', async () => {
      if (!confirm('Tem certeza que deseja limpar a lista de periciados?')) return;
      await SGF.limparPericiados();
      renderStats();
      toast('Lista de periciados limpa', 'info');
    });

    els.btnResetTudo.addEventListener('click', async () => {
      if (!confirm('ATENÇÃO: Isso irá limpar TODOS os dados. Deseja continuar?')) return;
      await SGF.limparHistorico();
      await SGF.limparPericiados();
      renderStats();
      toast('Dados resetados', 'info');
    });

    // Auditoria
    const btnExportAuditoria = document.getElementById('btn-export-auditoria');
    if (btnExportAuditoria) {
      btnExportAuditoria.addEventListener('click', () => {
        const token = SGF.getToken ? SGF.getToken() : sessionStorage.getItem('sgf_jfal_token');
        const url = (window.location.port === '80' || window.location.port === '' ? '/api' : `http://${window.location.hostname}:3000/api`) + '/admin/auditoria/csv';
        
        fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
          .then(res => res.blob())
          .then(blob => {
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(blob);
            a.download = 'auditoria_logs.csv';
            a.click();
          })
          .catch(err => toast('Erro ao exportar CSV', 'error'));
      });
    }
  }

  async function renderAuditoria() {
    const container = document.getElementById('auditoria-body');
    if (!container) return;
    try {
      const url = (window.location.port === '80' || window.location.port === '' ? '/api' : `http://${window.location.hostname}:3000/api`) + '/admin/dashboard';
      const token = SGF.getToken ? SGF.getToken() : sessionStorage.getItem('sgf_jfal_token');
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const logs = await res.json();
      
      if (!logs || logs.length === 0) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:0.8rem;">Nenhum registro encontrado.</div>';
        return;
      }
      
      container.innerHTML = logs.map(l => `
        <div style="border-bottom: 1px solid var(--border-color); padding: 8px 0; font-size: 0.8rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
            <strong style="color:var(--primary-400)">${SGF.escapeHtml(l.acao)}</strong>
            <span style="color:var(--text-muted)">${SGF.formatTime(l.criado_at)}</span>
          </div>
          <div>
            <span style="color:var(--text-muted)">Usuário:</span> ${SGF.escapeHtml(l.usuario_nome)} 
            <span style="color:var(--text-muted); margin-left: 8px;">IP:</span> ${SGF.escapeHtml(l.ip_address)}
          </div>
          ${l.detalhes ? `<div style="margin-top: 4px; font-family: monospace; font-size: 0.75rem; background: var(--bg-primary); padding: 4px; border-radius: 4px;">${SGF.escapeHtml(l.detalhes)}</div>` : ''}
        </div>
      `).join('');
    } catch (e) {
      console.error(e);
      container.innerHTML = '<div style="color:var(--danger-400);font-size:0.8rem;">Erro ao carregar logs.</div>';
    }
  }

  function updateYoutubePreview(url) {
    const preview = $('#youtube-preview');
    const iframe = $('#youtube-iframe');
    if (!preview || !iframe) return;
    const embedUrl = SGF.getYoutubeEmbedUrl(url);
    if (embedUrl && url) {
      iframe.src = embedUrl;
      preview.style.display = 'block';
    } else {
      iframe.src = '';
      preview.style.display = 'none';
    }
  }

  async function loadYoutube() {
    const url = await SGF.getYoutubeUrl();
    els.inputYoutube.value = url || '';
    updateYoutubePreview(url);
  }

  async function initApp() {
    renderSalasPericia();
    renderSalasAudiencia();
    loadYoutube();
    renderUsuarios();
    renderStats();
    renderAuditoria();
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
