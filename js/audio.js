/* NAPWORLD - procedural sound effects and music (WebAudio, no asset files) */
(function () {
  const NAP = window.NAP;
  const KEY = 'napworld-audio-v1';
  const A = (NAP.audio = { ctx: null, muted: false, mode: 'off', last: {}, beat: 0, nextT: 0, timer: null });
  try { A.muted = JSON.parse(localStorage.getItem(KEY) || '{}').muted === true; } catch (e) {}

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.8; A.master.connect(A.ctx.destination);
    A.sfxBus = A.ctx.createGain(); A.sfxBus.gain.value = 0.7; A.sfxBus.connect(A.master);
    A.musBus = A.ctx.createGain(); A.musBus.gain.value = 0.28; A.musBus.connect(A.master);
    // shared noise buffer
    const n = A.ctx.sampleRate * 1.5, buf = A.ctx.createBuffer(1, n, A.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    A.startMusicLoop();
  };
  A.setMuted = function (m) {
    A.muted = m;
    try { localStorage.setItem(KEY, JSON.stringify({ muted: m })); } catch (e) {}
    if (A.master) A.master.gain.value = m ? 0 : 0.8;
  };
  // throttle: only play if `gap` seconds have passed since last time for this key
  function ok(key, gap) {
    const t = performance.now() / 1000;
    if (A.last[key] && t - A.last[key] < gap) return false;
    A.last[key] = t; return true;
  }
  function noiseBurst(t, dur, freq, type, gain, bus) {
    const c = A.ctx, s = c.createBufferSource(); s.buffer = A.noise; s.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || A.sfxBus); s.start(t, Math.random() * 0.5, dur + 0.05);
  }
  function tone(t, freq, dur, type, gain, bus, slideTo) {
    const c = A.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || A.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  const SFX = {
    click: (t) => tone(t, 880, 0.05, 'triangle', 0.08),
    cannon: (t) => { noiseBurst(t, 0.5, 260, 'lowpass', 0.9); tone(t, 90, 0.5, 'sine', 0.8, null, 38); },
    musket: (t) => { noiseBurst(t, 0.07, 2600, 'highpass', 0.35); },
    volley: (t) => { for (let i = 0; i < 6; i++) noiseBurst(t + i * 0.035 + Math.random() * 0.03, 0.09, 2200, 'highpass', 0.28); },
    charge: (t) => { tone(t, 392, 0.22, 'sawtooth', 0.12); tone(t + 0.22, 523, 0.42, 'sawtooth', 0.14); },
    rout: (t) => tone(t, 330, 0.5, 'triangle', 0.1, null, 150),
    drum: (t) => { tone(t, 120, 0.18, 'sine', 0.5, null, 50); noiseBurst(t, 0.1, 1500, 'bandpass', 0.15); },
    roll: (t) => { for (let i = 0; i < 6; i++) { noiseBurst(t + i * 0.05, 0.07, 1800, 'bandpass', 0.18); } tone(t, 110, 0.3, 'sine', 0.35, null, 60); },
    fanfare: (t) => { [392, 494, 587, 784].forEach((f, i) => tone(t + i * 0.16, f, i === 3 ? 0.9 : 0.22, 'sawtooth', 0.1)); },
    defeat: (t) => { [330, 311, 262, 196].forEach((f, i) => tone(t + i * 0.28, f, 0.5, 'triangle', 0.12)); },
    bell: (t) => { tone(t, 660, 1.2, 'sine', 0.1); tone(t, 1320, 0.8, 'sine', 0.04); }
  };
  A.sfx = function (name, gap) {
    if (!A.ctx || A.muted) return;
    if (gap && !ok('s:' + name, gap)) return;
    try { SFX[name](A.ctx.currentTime + 0.001); } catch (e) {}
  };

  // ---- generative music: drone + marching drum, two moods
  const SCALE = { map: [0, 2, 3, 7, 5, 3, 2, 0], battle: [0, 0, 3, 0, 5, 3, 2, 0] };
  A.music = function (mode) { A.mode = mode; };
  A.startMusicLoop = function () {
    if (A.timer) return;
    A.nextT = A.ctx.currentTime + 0.2;
    A.timer = setInterval(() => {
      if (!A.ctx || A.muted || A.mode === 'off' || A.ctx.state !== 'running') { if (A.ctx) A.nextT = Math.max(A.nextT, A.ctx.currentTime); return; }
      const bpm = A.mode === 'battle' ? 118 : 84, step = 60 / bpm / 2;
      while (A.nextT < A.ctx.currentTime + 0.4) {
        const t = A.nextT, b = A.beat % 16;
        // drums
        if (b % 4 === 0) { tone(t, 100, 0.15, 'sine', A.mode === 'battle' ? 0.5 : 0.28, A.musBus, 45); }
        if (b % 4 === 2 || (A.mode === 'battle' && b % 2 === 1)) noiseBurst(t, 0.07, 1700, 'bandpass', A.mode === 'battle' ? 0.2 : 0.1, A.musBus);
        // drone / bass line every 4 steps
        if (b % 4 === 0) {
          const root = 55 * Math.pow(2, SCALE[A.mode][(A.beat >> 2) % 8] / 12);
          tone(t, root, step * 4 * 1.1, 'sawtooth', 0.09, A.musBus);
          tone(t, root * 1.5, step * 4 * 1.1, 'triangle', 0.06, A.musBus);
        }
        // fife-ish melody in map mode
        if (A.mode === 'map' && b % 8 === 6) tone(t, 220 * Math.pow(2, [0, 3, 7, 10, 12][(A.beat >> 3) % 5] / 12), step * 3, 'triangle', 0.05, A.musBus);
        A.beat++; A.nextT += step;
      }
    }, 120);
  };

  // first user gesture unlocks audio
  const unlock = () => { A.init(); };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && !b.dataset.nosound) A.sfx('click', 0.04); }, true);
})();
