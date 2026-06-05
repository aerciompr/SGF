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

  els.currentCall.style.display = 'none';

  let ytPlayer = null;
  let currentCallData = null;
  let callTimeout = null;
  let lastHistoricoId = -1; // initialized to -1 to catch the first call if starting from empty db
  let isFirstFetch = true;
  let ttsConfig = { uri: '', rate: 1, pitch: 1 };

  async function loadTTSConfig() {
    try {
      const res = await fetch(API_BASE + '/public/tts?t=' + new Date().getTime());
      ttsConfig = await res.json();
    } catch (e) { }
  }

  // ---- Clock ----
  function updateClock() {
    els.clock.textContent = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  // ---- YouTube ----
  async function loadYouTube() {
    try {
      const res = await fetch(API_BASE + '/public/youtube?t=' + new Date().getTime());
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
        onReady: (e) => { 
           e.target.playVideo(); 
           const overlay = document.getElementById('start-audio-overlay');
           if (!overlay || overlay.hidden) {
              e.target.unMute();
              e.target.setVolume(100);
           }
        },
      }
    });
  }

  function updateYouTubeUrl(url) {
    const container = $('.youtube-fullscreen');
    if (!url) {
      if (container) container.hidden = true;
      els.waitingState.style.display = 'block';
      if (ytPlayer && ytPlayer.destroy) {
          ytPlayer.destroy();
          ytPlayer = null;
      }
      return;
    }
    
    const embedUrl = getEmbedUrl(url);
    if (!embedUrl) return;

    if (container) container.hidden = false;
    els.waitingState.style.display = 'none';

    if (ytPlayer && ytPlayer.destroy) {
        ytPlayer.destroy();
        ytPlayer = null;
    }
    createPlayer(embedUrl);
  }

  // ---- Display Call ----
  function showCall(data, isRecall = false) {
    currentCallData = data;
    els.waitingState.style.display = 'none';
    els.currentCall.style.display = 'block';

    const container = $('.youtube-fullscreen');
    if (container) container.classList.add('video-dimmed');

    const tipoChamada = data.tipo || 'pericia';
    els.callTypeBadge.textContent = tipoChamada === 'pericia' ? 'Perícia' :
      tipoChamada === 'audiencia_parte' ? 'Audiência - Parte' : 'Audiência - Testemunha';
    els.callName.textContent = data.nome;
    els.callRoom.textContent = data.sala;

    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(10);

    playDingDong(() => {
      // Only speak if it is not a recall
      if (!isRecall) {
        speakCall(data.nome, data.sala);
      }
    });

    // Hide after 8 seconds
    clearTimeout(callTimeout);
    callTimeout = setTimeout(() => {
      hideCall();
    }, 8000);
  }

  function hideCall() {
    currentCallData = null;
    els.currentCall.style.display = 'none';
    
    const container = $('.youtube-fullscreen');
    if (container) container.classList.remove('video-dimmed');

    if (ytPlayer) {
      if (container) container.hidden = false;
      els.waitingState.style.display = 'none';
      if (ytPlayer.setVolume) {
        const overlay = document.getElementById('start-audio-overlay');
        if (!overlay || overlay.hidden) {
          ytPlayer.setVolume(100);
        }
      }
    } else {
      els.waitingState.style.display = 'block';
    }
  }

  function speakCall(nome, sala) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(`${nome}, por favor, dirija-se à ${sala}`);
    msg.lang = 'pt-BR';
    msg.rate = ttsConfig.rate || 1;
    msg.pitch = ttsConfig.pitch || 1;
    if (ttsConfig.uri) {
      const voices = speechSynthesis.getVoices();
      const voice = voices.find(v => v.voiceURI === ttsConfig.uri);
      if (voice) msg.voice = voice;
    }
    speechSynthesis.speak(msg);
  }

  function playDingDong(callback) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
         if (callback) callback();
         return;
      }
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc2.frequency.setValueAtTime(523.25, ctx.currentTime + 0.5); // C5

      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);

      osc1.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.5);

      setTimeout(() => {
        osc2.connect(gainNode);
        gainNode.gain.setValueAtTime(0, ctx.currentTime + 0.5);
        gainNode.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.55);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        osc2.start(ctx.currentTime + 0.5);
        osc2.stop(ctx.currentTime + 1.5);
      }, 500);

      setTimeout(() => {
        if (callback) callback();
      }, 1500);
    } catch(e) {
      if (callback) callback();
    }
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
      // Check for new calls in the history (cache buster added)
      const res = await fetch(API_BASE + '/public/historico?t=' + new Date().getTime());
      const historico = await res.json();

      if (historico.length > 0) {
        const latest = historico[0];
        const latestId = latest.id;

        if (!isFirstFetch && latestId > lastHistoricoId) {
          // New call detected!
          showCall(latest, false);
        }

        lastHistoricoId = latestId;
        updateTicker(historico);
      }
      isFirstFetch = false;
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
    loadTTSConfig();

    const overlay = document.getElementById('start-audio-overlay');
    if (overlay) {
      overlay.addEventListener('click', function() {
        this.hidden = true;
        // unlock audio
        if ('speechSynthesis' in window) {
           const msg = new SpeechSynthesisUtterance("");
           speechSynthesis.speak(msg);
        }
        if (ytPlayer && ytPlayer.unMute) {
           ytPlayer.unMute();
           ytPlayer.setVolume(100);
        }
      });
    }

    // Always load initial history on boot
    pollForUpdates();

    // Use WebSocket instead of polling
    if (typeof SGF !== 'undefined' && SGF.onSocketEvent) {
      SGF.onSocketEvent('update_historico', pollForUpdates);
      SGF.onSocketEvent('chamar_novamente', (data) => {
        showCall(data, true); // true = recall, plays ding-dong only
      });
      SGF.onSocketEvent('youtube_update', (data) => {
        updateYouTubeUrl(data.url);
      });
      SGF.onSocketEvent('tts_update', (data) => {
        ttsConfig = data;
      });
    } else {
      setInterval(pollForUpdates, 3000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
