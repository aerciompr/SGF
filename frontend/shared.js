/* ========================================
   SGF-JFAL - Shared API Client (shared.js)
   Replaces localStorage with REST API calls
   ======================================== */

const SGF = (function () {
  'use strict';

  // Usa sempre o mesmo host e porta que o navegador está acessando
  const API_BASE = window.location.origin + '/api';
  const TOKEN_KEY = 'sgf_jfal_token';
  const USER_KEY = 'sgf_jfal_user';

  const socketUrl = window.location.origin;
  const socket = typeof io !== 'undefined' ? io(socketUrl, {
    auth: (cb) => {
      cb({ token: getToken() });
    }
  }) : null;

  // ---- Token Management ----
  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  function setUser(user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY));
    } catch { return null; }
  }

  // ---- HTTP Helper ----
  async function apiFetch(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401 || res.status === 403) {
      // Token expired or invalid
      clearToken();
      
      // Auto redirect to login gracefully if not already on a login flow
      if (!window.location.pathname.includes('display.html')) {
        const modalLogin = document.getElementById('loginModal');
        if (modalLogin) {
          document.getElementById('appContent').style.display = 'none';
          modalLogin.classList.add('active');
          showToast(document.body, 'Sessão expirada. Faça login novamente.', 'error');
        }
      }
      return { error: 'Não autenticado', status: res.status };
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      return { error: data.error || 'Erro', status: res.status };
    }

    return res.json();
  }

  async function apiGet(endpoint) {
    return apiFetch(endpoint);
  }

  async function apiPost(endpoint, body) {
    return apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
  }

  async function apiPut(endpoint, body = {}) {
    return apiFetch(endpoint, { method: 'PUT', body: JSON.stringify(body) });
  }

  async function apiDelete(endpoint) {
    return apiFetch(endpoint, { method: 'DELETE' });
  }

  // ---- Autenticação ----
  async function login(modulo, usuario, senha) {
    const data = await apiPost('/auth/login', { usuario, senha, modulo });
    if (data.error) return false;
    setToken(data.token);
    setUser(data.user);
    return true;
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function logout() {
    clearToken();
  }

  function getLoggedUser() {
    const user = getUser();
    return user ? user.nome : null;
  }

  function getLoggedUserData() {
    return getUser();
  }

  function getLoggedPerfil() {
    const user = getUser();
    return user ? user.perfil : null;
  }

  // Check if the logged user has access to the given module
  function checkModuleAccess(modulo) {
    const perfil = getLoggedPerfil();
    if (!perfil) return false;
    if (perfil === 'admin') return true; // admin has access to everything
    return perfil === modulo;
  }

  // ---- Usuários (admin) ----
  async function getUsuarios() {
    return apiGet('/usuarios');
  }

  async function addUsuario(dados) {
    return apiPost('/usuarios', dados);
  }

  async function updateUsuario(id, dados) {
    return apiPut(`/usuarios/${id}`, dados);
  }

  async function removeUsuario(id) {
    return apiDelete(`/usuarios/${id}`);
  }

  // ---- Salas ----
  async function getSalas(tipo) {
    return apiGet(`/salas${tipo ? '?tipo=' + tipo : ''}`);
  }

  async function addSala(nome, andar, tipo) {
    return apiPost('/salas', { nome, andar, tipo });
  }

  async function updateSala(id, dados) {
    return apiPut(`/salas/${id}`, dados);
  }

  async function removeSala(id) {
    return apiDelete(`/salas/${id}`);
  }

  async function toggleSala(id, ativo) {
    return apiPut(`/salas/${id}`, { ativo });
  }

  // ---- Peritos ----
  async function getPeritos() {
    return apiGet('/peritos');
  }

  // ---- Periciados ----
  async function getPericiados(peritoId) {
    return apiGet(`/periciados${peritoId ? '?perito_id=' + peritoId : ''}`);
  }

  async function addPericiado(dados) {
    return apiPost('/periciados', dados);
  }

  async function confirmarChegada(id) {
    return apiPut(`/periciados/${id}/chegada`);
  }

  async function chamarPericiado(id, sala) {
    return apiPut(`/periciados/${id}/chamar`, { sala });
  }

  async function marcarAtendido(id) {
    return apiPut(`/periciados/${id}/atendido`);
  }

  async function marcarNaoCompareceu(id) {
    return apiPut(`/periciados/${id}/nao-compareceu`);
  }

  async function removerPericiado(id) {
    return apiDelete(`/periciados/${id}`);
  }

  async function limparPericiados() {
    return apiDelete('/periciados');
  }

  // ---- Pautas / Audiências ----
  async function getPautas() {
    return apiGet('/pautas');
  }

  async function criarPauta(processo, salaId) {
    return apiPost('/pautas', { processo, sala_id: salaId });
  }

  async function iniciarAudiencia(pautaId) {
    return apiPut(`/pautas/${pautaId}/iniciar`);
  }

  async function finalizarAudiencia(pautaId) {
    return apiPut(`/pautas/${pautaId}/finalizar`);
  }

  async function removerPauta(pautaId) {
    return apiDelete(`/pautas/${pautaId}`);
  }

  async function addParte(pautaId, nome, tipo) {
    return apiPost(`/pautas/${pautaId}/partes`, { nome, tipo });
  }

  async function removerParte(pautaId, parteId) {
    return apiDelete(`/pautas/${pautaId}/partes/${parteId}`);
  }

  async function addTestemunha(pautaId, parteId, nome) {
    return apiPost(`/pautas/${pautaId}/partes/${parteId}/testemunhas`, { nome });
  }

  async function removerTestemunha(pautaId, parteId, testId) {
    return apiDelete(`/pautas/${pautaId}/partes/${parteId}/testemunhas/${testId}`);
  }

  async function chamarPessoa(tipo, id, sala, processo) {
    return apiPut(`/pautas/pessoas/${tipo}/${id}/chamar`, { sala, processo });
  }

  async function marcarPresente(tipo, id) {
    return apiPut(`/pautas/pessoas/${tipo}/${id}/presente`);
  }

  async function marcarAusente(tipo, id) {
    return apiPut(`/pautas/pessoas/${tipo}/${id}/ausente`);
  }

  async function resetarStatusPessoa(tipo, id) {
    return apiPut(`/pautas/pessoas/${tipo}/${id}/resetar`);
  }

  // ---- Config ----
  async function getYoutubeUrl() {
    const data = await apiGet('/config/youtube');
    return data.url || '';
  }

  async function setYoutubeUrl(url) {
    return apiPut('/config/youtube', { url });
  }

  function getYoutubeEmbedUrl(url) {
    if (!url) return '';
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&controls=0&showinfo=0&rel=0`;
    return url;
  }

  // ---- Histórico ----
  async function getHistorico() {
    return apiGet('/config/historico');
  }

  async function limparHistorico() {
    return apiDelete('/config/historico');
  }

  // ---- Stats ----
  async function getStats() {
    return apiGet('/config/stats');
  }

  // ---- Utils ----
  function escapeHtml(text) {
    if (typeof text !== 'string') text = String(text || '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTime(ts) {
    if (!ts) return '--:--';
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function updateClock(el) {
    if (el) el.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function showToast(container, message, type = 'info') {
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    const safeMessage = escapeHtml(message);
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${type === 'success' ? '<polyline points="20 6 9 17 4 12"/>' :
          type === 'error' ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>' :
          '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'}
      </svg>
      <span>${safeMessage}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut var(--transition-normal) ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) { /* ignore */ }
  }

  const STATUS_LABELS = {
    aguardando: 'Aguardando',
    presente: 'Presente',
    chamado: 'Chamado',
    atendido: 'Atendido',
    ausente: 'Ausente',
    em_andamento: 'Em Andamento',
    finalizada: 'Finalizada',
  };

  const STATUS_COLORS = {
    aguardando: 'var(--text-muted)',
    presente: 'var(--primary-400)',
    chamado: 'var(--warning-400)',
    atendido: 'var(--success-400)',
    ausente: 'var(--danger-400)',
    em_andamento: 'var(--warning-400)',
    finalizada: 'var(--success-400)',
  };

  // Socket event listener helper replacing polling
  function onSocketEvent(event, callback) {
    if (socket) {
      socket.on(event, callback);
      return function offEvent() {
        socket.off(event, callback);
      };
    } else {
      console.warn('Socket.io não carregado. Recarregamento em tempo real desativado.');
      return () => {};
    }
  }

  // Public API
  return {
    // Auth
    login, isLoggedIn, logout, getLoggedUser, getLoggedUserData,
    getLoggedPerfil, checkModuleAccess,
    // Usuarios
    getUsuarios, addUsuario, updateUsuario, removeUsuario,
    // Salas
    getSalas, addSala, updateSala, removeSala, toggleSala,
    // Peritos
    getPeritos,
    // Periciados
    getPericiados, addPericiado, confirmarChegada, chamarPericiado,
    marcarAtendido, marcarNaoCompareceu, removerPericiado, limparPericiados,
    // Pautas
    getPautas, criarPauta, iniciarAudiencia, finalizarAudiencia, removerPauta,
    addParte, removerParte, addTestemunha, removerTestemunha,
    chamarPessoa, marcarPresente, marcarAusente, resetarStatusPessoa,
    // Config
    getYoutubeUrl, setYoutubeUrl, getYoutubeEmbedUrl,
    getHistorico, limparHistorico, getStats,
    // Utils
    escapeHtml, formatTime, updateClock, showToast, playNotificationSound,
    onSocketEvent, socket,
    STATUS_LABELS, STATUS_COLORS,
  };
})();
