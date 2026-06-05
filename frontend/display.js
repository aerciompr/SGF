/* ========================================
   SGF-JFAL - Display Logic (display.js)
   Lógica totalmente reescrita - v3
   ======================================== */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const API_BASE = window.location.origin + '/api';

  /* --- Elementos DOM --- */
  const elOverlay     = $('#start-audio-overlay');
  const elCurrentCall = $('#current-call');
  const elWaiting     = $('#waiting-state');
  const elYtWrap      = $('#youtube-container');
  const elClock       = $('#display-clock');
  const elTypeBadge   = $('#call-type-badge');
  const elName        = $('#call-name');
  const elRoom        = $('#call-room');
  const elTicker      = $('#history-ticker');

  /* --- Estado --- */
  let ytPlayer         = null;
  let lastCallId       = 0;   // 0 = nenhum chamado ainda visto
  let callTimeout      = null;
  let ttsConfig        = { uri: '', rate: 1, pitch: 1 };
  let audioUnlocked    = false;
  let initialLoadDone  = false;

  /* ==========================================
     HELPERS: show/hide usando removeAttribute
     em vez de style.display para não conflitar
     com [hidden] { display:none !important }
  ========================================== */
  function show(el) {
    if (!el) return;
    el.removeAttribute('hidden');
  }
  function hide(el) {
    if (!el) return;
    el.setAttribute('hidden', '');
  }

  /* ==========================================
     RELÓGIO
  ========================================== */
  function updateClock() {
    if (elClock) {
      elClock.textContent = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    }
  }

  /* ==========================================
     ÁUDIO - ding-dong + TTS
  ========================================== */
  function loadTTSConfig() {
    fetch(API_BASE + '/public/tts?t=' + Date.now())
      .then(r => r.json())
      .then(d => { ttsConfig = d; })
      .catch(() => {});
  }

  function playDingDong(callback) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { callback && callback(); return; }
      const ctx = new Ctx();
      function tone(freq, start, dur) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      }
      tone(659.25, 0,   0.45); // E5
      tone(523.25, 0.5, 0.9);  // C5
      setTimeout(() => { callback && callback(); }, 1500);
    } catch (e) { callback && callback(); }
  }

  function speakCall(nome, sala) {
    if (!audioUnlocked || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(
      `${nome}, por favor, dirija-se à ${sala}`
    );
    msg.lang  = 'pt-BR';
    msg.rate  = ttsConfig.rate  || 1;
    msg.pitch = ttsConfig.pitch || 1;
    if (ttsConfig.uri) {
      const v = speechSynthesis.getVoices().find(v => v.voiceURI === ttsConfig.uri);
      if (v) msg.voice = v;
    }
    speechSynthesis.speak(msg);
  }

  /* ==========================================
     EXIBIR / ESCONDER CHAMADA
  ========================================== */
  function showCall(data) {
    /* Atualiza dados */
    const tipo = data.tipo || 'pericia';
    elTypeBadge.textContent =
      tipo === 'pericia'             ? 'PERÍCIA' :
      tipo === 'audiencia_parte'     ? 'AUDIÊNCIA – PARTE' : 'AUDIÊNCIA – TESTEMUNHA';
    elName.textContent = data.nome || '';
    elRoom.textContent = data.sala || '';

    /* Mostra o painel de chamada */
    hide(elWaiting);
    show(elCurrentCall);

    /* Esmaece vídeo */
    if (elYtWrap) elYtWrap.classList.add('video-dimmed');

    /* Baixa volume do YouTube */
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(10);

    /* Som + voz */
    playDingDong(() => speakCall(data.nome, data.sala));

    /* Volta ao normal após 8 s */
    clearTimeout(callTimeout);
    callTimeout = setTimeout(hideCall, 8000);
  }

  function hideCall() {
    hide(elCurrentCall);
    if (elYtWrap) elYtWrap.classList.remove('video-dimmed');

    if (ytPlayer && ytPlayer.setVolume && audioUnlocked) {
      ytPlayer.setVolume(100);
      show(elYtWrap);
      hide(elWaiting);
    } else if (!ytPlayer) {
      show(elWaiting);
    }
  }

  /* ==========================================
     YOUTUBE
  ========================================== */
  function getVideoId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/))([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function createYTPlayer(videoId) {
    if (!videoId) return;
    if (!window.YT || !window.YT.Player) {
      window.onYouTubeIframeAPIReady = () => createYTPlayer(videoId);
      return;
    }
    // Limpa player anterior
    if (ytPlayer && ytPlayer.destroy) { ytPlayer.destroy(); ytPlayer = null; }
    elYtWrap.innerHTML = '<div id="youtube-player"></div>';
    ytPlayer = new YT.Player('youtube-player', {
      width: '100%', height: '100%',
      videoId,
      playerVars: { autoplay: 1, mute: 1, loop: 1, controls: 0, rel: 0, playlist: videoId },
      events: {
        onReady(e) {
          e.target.playVideo();
          if (audioUnlocked) { e.target.unMute(); e.target.setVolume(100); }
        }
      }
    });
  }

  function loadYouTube() {
    fetch(API_BASE + '/public/youtube?t=' + Date.now())
      .then(r => r.json())
      .then(d => applyYouTubeUrl(d.url || ''))
      .catch(() => {});
  }

  function applyYouTubeUrl(url) {
    const vid = getVideoId(url);
    if (!vid) {
      hide(elYtWrap);
      show(elWaiting);
      return;
    }
    show(elYtWrap);
    hide(elWaiting);
    createYTPlayer(vid);
  }

  /* ==========================================
     TICKER (últimas chamadas)
  ========================================== */
  function updateTicker(historico) {
    if (!elTicker) return;
    elTicker.innerHTML = '';
    historico.slice(0, 8).forEach(h => {
      const div = document.createElement('div');
      div.className = 'ticker-item';
      div.innerHTML = `
        <span class="ticker-item-name">${esc(h.nome)}</span>
        <span class="ticker-item-room">→ ${esc(h.sala)}</span>
        <span class="ticker-item-time">${fmtTime(h.chamado_at)}</span>
      `;
      elTicker.appendChild(div);
    });
  }

  /* ==========================================
     POLLING + DETECÇÃO DE NOVA CHAMADA
  ========================================== */
  async function poll() {
    try {
      const res = await fetch(API_BASE + '/public/historico?t=' + Date.now());
      if (!res.ok) return;
      const historico = await res.json();

      // Sempre atualiza o ticker
      if (historico.length > 0) updateTicker(historico);

      // Na primeira carga, apenas registra o ID mais recente sem chamar
      if (!initialLoadDone) {
        if (historico.length > 0) lastCallId = historico[0].id;
        initialLoadDone = true;
        return;
      }

      // Verifica se há chamada nova
      if (historico.length > 0) {
        const latest = historico[0];
        if (latest.id > lastCallId) {
          lastCallId = latest.id;
          showCall(latest);
        }
      }
    } catch (e) { /* não travar o painel */ }
  }

  /* ==========================================
     OVERLAY DE ÁUDIO (política do navegador)
  ========================================== */
  function initOverlay() {
    if (!elOverlay) return;
    elOverlay.addEventListener('click', () => {
      audioUnlocked = true;
      hide(elOverlay);
      // Tenta desmutar YT
      if (ytPlayer && ytPlayer.unMute) {
        ytPlayer.unMute();
        ytPlayer.setVolume(100);
      }
      // Unlock speechSynthesis
      if ('speechSynthesis' in window) {
        const silent = new SpeechSynthesisUtterance('');
        speechSynthesis.speak(silent);
      }
    });
  }

  /* ==========================================
     SOCKET.IO (recebe evento instantâneo)
  ========================================== */
  function initSocket() {
    if (typeof io === 'undefined') return;
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });

    socket.on('connect', () => console.log('Socket conectado'));

    socket.on('update_historico', () => {
      // Evento recebido → faz poll imediato para obter dados
      poll();
    });

    socket.on('chamar_novamente', (data) => {
      showCall(data); // recall sem verificar ID
    });

    socket.on('youtube_update', (data) => {
      applyYouTubeUrl(data.url || '');
    });

    socket.on('tts_update', (data) => {
      ttsConfig = data;
    });
  }

  /* ==========================================
     UTILITÁRIOS
  ========================================== */
  function esc(t) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(t || ''));
    return d.innerHTML;
  }
  function fmtTime(ts) {
    if (!ts) return '--:--';
    const d = new Date(ts);
    if (isNaN(d)) return '--:--';
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /* ==========================================
     PARTICLES
  ========================================== */
  function initParticles() {
    const c = $('.particles');
    if (!c) return;
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (8 + Math.random() * 12) + 's';
      p.style.animationDelay    = Math.random() * 8 + 's';
      c.appendChild(p);
    }
  }

  /* ==========================================
     INICIALIZAÇÃO
  ========================================== */
  function init() {
    initParticles();
    initOverlay();
    initSocket();
    updateClock();
    setInterval(updateClock, 1000);
    loadYouTube();
    loadTTSConfig();

    // Primeira carga: registra estado atual sem disparar chamada
    poll();

    // Polling de segurança a cada 5s (fallback para quando socket falha)
    setInterval(poll, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
