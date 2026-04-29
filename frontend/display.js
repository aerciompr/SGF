/* ========================================
   SGF-JFAL - Display Logic (display.js)
   Uses polling to get latest calls from API
   ======================================== */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const API_BASE = window.location.port === '80' || window.location.port === ''
    ? '/api'
    : `http://${window.location.hostname}:3000/api`;

  const els = {
    clock: $('#display-clock'),
    main: $('.display-main'),
    waitingState: $('#waiting-state'),
    currentCall: $('#current-call'),
    callTypeBadge: $('#call-type-badge'),
    callName: $('#call-name'),
    callRoomLabel: $('#call-room-label'),
    callRoom: $('#call-room'),
    historyTicker: $('#history-ticker'),
  };

  let ytPlayer = null;
  let currentCallData = null;
  let callTimeout = null;
  let lastHistoricoId = 0;

  // ---- Clock ----
  function updateClock() {
    els.clock.textContent = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  // ---- YouTube ----
  async function loadYouTube() {
    try {
      const res = await fetch(API_BASE + '/public/youtube');
      const data = await res.json();
      const url = data.url || '';

      const container = $('.youtube-fullscreen');
      if (!url) {
        if (container) container.hidden = true;
        els.waitingState.hidden = false;
        return;
      }

      const embedUrl = getEmbedUrl(url);
      if (!embedUrl) return;

      // Show the YouTube container
      if (container) container.hidden = false;
      els.waitingState.hidden = true;

      // YT API is already loaded from HTML script tag
      if (typeof YT !== 'undefined' && YT.Player) {
        createPlayer(embedUrl);
      } else {
        // Wait for it to load
        window.onYouTubeIframeAPIReady = () => createPlayer(embedUrl);
      }
    } catch (e) {
      console.error('YouTube load error:', e);
    }
  }

  function getEmbedUrl(url) {
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    if (m) return `https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&controls=0&showinfo=0&rel=0&enablejsapi=1`;
    return url;
  }

  function createPlayer(embedUrl) {
    const container = $('.youtube-fullscreen');
    if (!container) return;
    container.innerHTML = '<div id="youtube-player"></div>';
    ytPlayer = new YT.Player('youtube-player', {
      width: '100%',
      height: '100%',
      videoId: embedUrl.match(/embed\/([^?]+)/)?.[1] || '',
      playerVars: {
        autoplay: 1, mute: 1, loop: 1, controls: 0, showinfo: 0, rel: 0,
        playlist: embedUrl.match(/embed\/([^?]+)/)?.[1] || '',
      },
      events: {
        onReady: (e) => { e.target.playVideo(); },
      }
    });
  }

  // ---- Display Call ----
  function showCall(data) {
    currentCallData = data;
    els.waitingState.hidden = true;
    els.currentCall.hidden = false;

    const tipoChamada = data.tipo || 'pericia';
    els.callTypeBadge.textContent = tipoChamada === 'pericia' ? 'Perícia' :
      tipoChamada === 'audiencia_parte' ? 'Audiência - Parte' : 'Audiência - Testemunha';
    els.callName.textContent = data.nome;
    els.callRoom.textContent = data.sala;

    // Mute YouTube while showing call
    if (ytPlayer && ytPlayer.mute) ytPlayer.mute();

    // Speak the name
    speakCall(data.nome, data.sala);

    // Hide after 15 seconds
    clearTimeout(callTimeout);
    callTimeout = setTimeout(() => {
      hideCall();
    }, 15000);
  }

  function hideCall() {
    currentCallData = null;
    els.currentCall.hidden = true;
    // Show YouTube if available, otherwise show waiting state
    const container = $('.youtube-fullscreen');
    if (container && !container.hidden && ytPlayer) {
      els.waitingState.hidden = true;
      if (ytPlayer.unMute) ytPlayer.unMute();
    } else {
      els.waitingState.hidden = false;
    }
  }

  function speakCall(nome, sala) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(`${nome}, por favor, dirija-se à ${sala}`);
    msg.lang = 'pt-BR';
    msg.rate = 0.9;
    msg.pitch = 1;
    speechSynthesis.speak(msg);
  }

  // ---- History Ticker ----
  function updateTicker(historico) {
    els.historyTicker.innerHTML = '';
    const items = historico.slice(0, 8);
    items.forEach(h => {
      const div = document.createElement('div');
      div.className = 'ticker-item';
      div.innerHTML = `
        <span class="ticker-item-name">${escapeHtml(h.nome)}</span>
        <span class="ticker-item-room">→ ${escapeHtml(h.sala)}</span>
        <span class="ticker-item-time">${formatTime(h.chamado_at)}</span>
      `;
      els.historyTicker.appendChild(div);
    });
  }

  // ---- Polling ----
  async function pollForUpdates() {
    try {
      // Check for new calls in the history
      const res = await fetch(API_BASE + '/public/historico');
      const historico = await res.json();

      if (historico.length > 0) {
        const latest = historico[0];
        const latestId = latest.id;

        if (latestId > lastHistoricoId && lastHistoricoId > 0) {
          // New call detected!
          showCall(latest);
        }

        lastHistoricoId = latestId;
        updateTicker(historico);
      }
    } catch (e) {
      // Silently fail - display should never crash
    }
  }

  // ---- Utils ----
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text || ''));
    return div.innerHTML;
  }

  function formatTime(ts) {
    if (!ts) return '--:--';
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  // ---- Particles ----
  function initParticles() {
    const container = $('.particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (8 + Math.random() * 12) + 's';
      p.style.animationDelay = Math.random() * 8 + 's';
      container.appendChild(p);
    }
  }

  // ---- Init ----
  function init() {
    initParticles();
    updateClock();
    setInterval(updateClock, 1000);
    loadYouTube();

    // Use WebSocket instead of polling
    if (typeof SGF !== 'undefined' && SGF.onSocketEvent) {
      SGF.onSocketEvent('update_historico', pollForUpdates);
    } else {
      pollForUpdates();
      setInterval(pollForUpdates, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
