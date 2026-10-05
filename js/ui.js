/* NAPWORLD - user interface: start screen, campaign map interaction, panels, dialogs */
(function () {
  const NAP = window.NAP;
  const C = NAP.C;
  const $ = (s, el) => (el || document).querySelector(s);
  const F = (id) => NAP.FACTIONS[id];
  const U = NAP.UNITS;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const SAVE_KEY = 'napworld-save-v1', AUTOSAVE_KEY = 'napworld-autosave-v1', SUMMARY_KEY = 'napworld-summary-off';

  const ui = (NAP.ui = {
    sel: { prov: null, army: null }, cam: { x: 525, y: 555, z: 0.8 }, hover: null, opts: {}, picked: 'russia', difficulty: 'normal', minor: false
  });
  const canvas = $('#map'), ctx = canvas.getContext('2d');
  let vw = 0, vh = 0, dpr = 1, dirty = true;
  ui.folds = {}; ui.playback = lsGet('napworld-playback') || 'normal';
  if (document.fonts && document.fonts.load) Promise.all(["16px IM Fell English", "italic 16px IM Fell English", "700 16px Cinzel", "700 16px Cinzel Decorative"].map((f) => document.fonts.load(f).catch(() => {}))).then(() => { dirty = true; });

  // ------------------------------------------------------------------ utilities
  function modal(html, cls) {
    return new Promise((resolve) => {
      const m = $('#modal');
      m.innerHTML = `<div class="dlg ${cls || ''}">${html}</div>`;
      m.hidden = false;
      m._resolve = (v) => { m.hidden = true; m.innerHTML = ''; resolve(v); };
      m.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => m._resolve(b.dataset.r)));
    });
  }
  function closeModal(v) { const m = $('#modal'); if (m._resolve) m._resolve(v); }
  function toast(text) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text;
    $('#app').appendChild(t); setTimeout(() => t.remove(), 1800);
  }
  const flag = (f) => `<span class="sw" style="background:${F(f).color}"></span>`;
  const S = () => C.get();

  // ------------------------------------------------------------------ start screen
  function startFactionStats(id) {
    const ps = NAP.PROVINCE_DEFS.filter((p) => p.owner === id);
    const inc = ps.reduce((s, p) => s + p.income, 0);
    const units = (NAP.START_ARMIES[id] || []).reduce((s, a) => s + a[2].split(' ').reduce((t, x) => t + +x.split(':')[1], 0), 0);
    return { n: ps.length, inc, units };
  }
  const DIFF = { france: 3, britain: 1, austria: 2, prussia: 2, russia: 1, ottoman: 4, spain: 3, portugal: 5, sweden: 4, denmark: 4, naples: 4, bavaria: 4 };
  function showNations() {
    $('#start').className = '';
    let picked = null;
    let html = `<div class="navbar"><button id="backbtn">&larr; Back</button><h1>Choose your nation</h1><div class="navright"><label>Difficulty <select id="diff"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option></select></label></div></div>
      <div class="beginrow"><button class="primary bigbegin" id="beginbtn" hidden>Begin the Campaign</button></div>
      <div class="cards">`;
    const order = Object.keys(NAP.NATION_GUIDE).sort((x, y) => NAP.NATION_GUIDE[x].rank - NAP.NATION_GUIDE[y].rank);
    for (const id of order) {
      const f = F(id), st = startFactionStats(id), g = NAP.NATION_GUIDE[id];
      const tips = '<b>' + esc(f.name) + '</b><br>' + g.tips.map((t) => '\u2022 ' + esc(t)).join('<br>');
      html += `<div class="card" data-f="${id}" style="--c:${f.color}" data-tip="${esc(tips)}">${g.ribbon ? `<span class="ribbon">${esc(g.ribbon)}</span>` : ''}
        <h3>${esc(f.name)}</h3><div class="leader">${esc(f.leader)}</div>
        <div><span class="tier tier-${g.tier.toLowerCase()}">${g.label || g.tier}</span>${g.war ? '<span class="tag war" style="margin-left:6px">starts at war</span>' : '<span class="tag peace" style="margin-left:6px">starts at peace</span>'}</div>
        <p>${esc(f.desc)}</p><ul class="perks">${(NAP.PERKS[id] ? NAP.PERKS[id].plus.map((e) => `<li class="pl">${esc(e.t)}</li>`).concat(NAP.PERKS[id].minus.map((e) => `<li class="mi">${esc(e.t)}</li>`)) : []).join('')}</ul><p class="why"><b>Why ${(g.label || g.tier).toLowerCase().replace("!", "")}:</b> ${esc(g.why)}</p>
        <div class="stats"><span>${st.n} provinces</span><span>${st.units} regiments</span></div></div>`;
    }
    html += `</div><div class="beginrow"><button class="primary bigbegin" id="beginbtn2" hidden>Begin the Campaign</button></div>`;
    $('#start').innerHTML = html; $('#start').hidden = false; $('#start').scrollTop = 0;
    $('#diff').value = ui.difficulty;
    $('#diff').onchange = (e) => (ui.difficulty = e.target.value);
    $('#start').querySelectorAll('.card').forEach((c) => (c.onclick = () => {
      picked = c.dataset.f; ui.picked = picked;
      $('#start').querySelectorAll('.card').forEach((x) => x.classList.toggle('sel', x === c));
      for (const id of ['#beginbtn', '#beginbtn2']) { const bb = $(id); bb.hidden = false; bb.textContent = `Begin as ${F(picked).adj} \u2192`; }
    }));
    // naval warfare is asked at the moment you begin
    const begin = async () => {
      if (!picked) return;
      const r = await modal(`<h2>Naval warfare?</h2><div class="body"><p><b>Off</b> (standard): the seas are a simple transport network. Armies cross between ports and nothing can stop them.</p><p><b>On</b> (<span class="bad">harder</span>): every nation has a fleet, you build ships at Shipyards, and enemy fleets can <b>blockade</b> your ports (income halved, no shipbuilding) and cut your armies' sea crossings. You need your own navy to keep the sea lanes open. It is more to manage and a real extra threat, so it is best once you know the basics.</p></div><div class="foot"><button data-r="back">Cancel</button><button data-r="off" ${ui.naval ? '' : 'class="primary"'}>Naval warfare off</button><button data-r="on" ${ui.naval ? 'class="primary"' : ''}>Naval warfare on (harder)</button></div>`);
      if (r === 'off' || r === 'on') { ui.naval = r === 'on'; beginGame(picked); }
    };
    $('#beginbtn').onclick = begin; $('#beginbtn2').onclick = begin;
    $('#backbtn').onclick = showStart;
  }
  // painted-in-code backdrop for the title screen: dusk sky, powder smoke, ridgelines of marching infantry, guns and a cavalry officer
  function titleArt() {
    let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ridge = (x, base, a1, a2, ph) => base + Math.sin(x / a1 + ph) * 22 + Math.sin(x / a2 + ph * 2) * 9;
    const path = (base, a1, a2, ph) => { let d = `M0 900 L0 ${ridge(0, base, a1, a2, ph).toFixed(1)}`; for (let x = 20; x <= 1620; x += 20) d += ` L${x} ${ridge(x, base, a1, a2, ph).toFixed(1)}`; return d + ' L1600 900 Z'; };
    const men = (base, a1, a2, ph, n, sc, col, y0, speed) => { let o = ''; for (let i = 0; i < n; i++) { const x = 40 + i * (1520 / n) + rnd() * 6; o += `<g class="sol" data-b="${base}" data-a1="${a1}" data-a2="${a2}" data-ph="${ph}" data-sc="${sc}" data-y0="${y0 || 0}" data-sp="${speed}" data-x="${x.toFixed(1)}" data-w="${(rnd() * 6.28).toFixed(2)}" fill="${col}"><rect class="lg1" x="-3" y="-1" width="2.4" height="7"/><rect class="lg2" x="0.6" y="-1" width="2.4" height="7"/><rect x="-2.2" y="-14" width="4.4" height="13"/><circle cx="0" cy="-17" r="2.8"/><rect x="-2.8" y="-24" width="5.6" height="6"/><rect x="2.5" y="-30" width="1" height="26"/></g>`; } return o; };
    const smoke = (x, y, r, o) => `<ellipse cx="${x}" cy="${y}" rx="${r * 1.6}" ry="${r * 0.7}" fill="rgba(230,205,170,${o})" filter="url(#bl)"/>`;
    return `<svg class="titleart" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1426"/><stop offset=".45" stop-color="#2c2a4a"/><stop offset=".72" stop-color="#9a4a3a"/><stop offset=".88" stop-color="#e9a15a"/><stop offset="1" stop-color="#f6cf86"/></linearGradient>
        <radialGradient id="sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff0c0" stop-opacity=".95"/><stop offset=".35" stop-color="#ffc870" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a50" stop-opacity="0"/></radialGradient>
        <radialGradient id="vig" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
        <filter id="bl"><feGaussianBlur stdDeviation="14"/></filter>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)"/>
      <circle cx="1130" cy="640" r="320" fill="url(#sun)"/>
      ${Array.from({ length: 70 }, () => `<circle cx="${(rnd() * 1600).toFixed(0)}" cy="${(rnd() * 330).toFixed(0)}" r="${(rnd() * 1.3 + 0.3).toFixed(1)}" fill="#fff" opacity="${(rnd() * 0.6 + 0.2).toFixed(2)}"/>`).join('')}
      <g class="drift">${smoke(260, 560, 170, 0.5)}${smoke(640, 620, 220, 0.42)}${smoke(1040, 560, 190, 0.38)}${smoke(1400, 600, 210, 0.45)}${smoke(820, 470, 150, 0.2)}</g>
      <path d="${path(640, 140, 53, 1)}" fill="#4a3a52"/>
      <path d="${path(700, 120, 41, 2.4)}" fill="#33283f"/>
      ${men(700, 120, 41, 2.4, 70, 0.42, '#2a2034', 4, 7)}
      <path d="${path(770, 160, 63, 4)}" fill="#241b30"/>
      ${men(770, 160, 63, 4, 56, 0.66, '#17111f', 4, 11)}
      <path d="${path(840, 190, 47, 0.5)}" fill="#120d19"/>
      ${men(840, 190, 47, 0.5, 40, 1.0, '#0b0710', 5, 17)}
      <g transform="translate(250 ${(ridge(250, 840, 190, 47, 0.5) - 6).toFixed(0)})" fill="#08050c"><rect x="-40" y="-26" width="86" height="10" rx="4" transform="rotate(-8)"/><circle cx="-6" cy="-10" r="19"/><circle cx="-6" cy="-10" r="5" fill="#241b30"/><rect x="-32" y="-8" width="64" height="5"/><path d="M-60 -2 l30 -8 l0 10 z"/></g>
      <g transform="translate(1210 ${(ridge(1210, 840, 190, 47, 0.5) - 4).toFixed(0)})" fill="#08050c"><rect x="-4" y="-130" width="3" height="130"/><path class="flagwave" d="M-1 -130 q26 -10 50 0 q-10 14 0 28 q-26 -10 -50 0 z" fill="#7a1c24"/><ellipse cx="-72" cy="-52" rx="30" ry="15"/><rect x="-92" y="-38" width="5" height="40"/><rect x="-60" y="-38" width="5" height="40"/><rect x="-100" y="-40" width="52" height="8"/><path d="M-48 -62 q18 -24 34 -4 l-14 14 z"/><circle cx="-60" cy="-86" r="7"/><rect x="-65" y="-80" width="10" height="24" rx="3"/></g>
      <rect width="1600" height="900" fill="url(#vig)"/></svg>`;
  }
  // the columns march across the ridges (left to right, far ranks slower); legs swing and the men bob
  let marchRaf = 0;
  function startMarch() {
    cancelAnimationFrame(marchRaf);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = [...document.querySelectorAll('.titleart .sol')].map((g) => ({ g, b: +g.dataset.b, a1: +g.dataset.a1, a2: +g.dataset.a2, ph: +g.dataset.ph, sc: +g.dataset.sc, y0: +g.dataset.y0, sp: +g.dataset.sp, x0: +g.dataset.x, w: +g.dataset.w, l1: g.querySelector('.lg1'), l2: g.querySelector('.lg2') }));
    const t0 = performance.now(), SPAN = 1760;
    const frame = (now) => {
      if (!document.querySelector('.titleart')) return;
      const t = reduce ? 0 : (now - t0) / 1000;
      for (const e of els) {
        const x = ((e.x0 + e.sp * t + 80) % SPAN) - 80, step = t * e.sp * 0.5 + e.w, sw = Math.sin(step * 0.9);
        const y = e.b + Math.sin(x / e.a1 + e.ph) * 22 + Math.sin(x / e.a2 + e.ph * 2) * 9 + e.y0 - Math.abs(sw) * 1.1 * e.sc * 2;
        e.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${e.sc})`);
        e.l1.setAttribute('transform', `translate(0 ${(sw * 1.8).toFixed(2)})`); e.l2.setAttribute('transform', `translate(0 ${(-sw * 1.8).toFixed(2)})`);
      }
      marchRaf = requestAnimationFrame(frame);
    };
    marchRaf = requestAnimationFrame(frame);
  }
  // ---- title screen: just the way in; nations are chosen on the next screen
  function showStart() {
    if (ui.tut && ui.tut.on) tutEnd();
    $('#game').hidden = true; $('#battle').hidden = true;
    const has = !!lsGet(SAVE_KEY), hasAuto = !!lsGet(AUTOSAVE_KEY);
    $('#start').className = 'title';
    $('#start').innerHTML = `${titleArt()}<div class="titlebox"><h1>Savage Napoleonic<br>War Simulation</h1><div class="orn"><i></i><span>&#9876;</span><i></i></div><div class="sub">Europe, 1805 &mdash; the Emperor's ambition, the old order's last stand</div>
      <div class="menu">
        ${hasAuto ? '<button id="autobtn" class="primary">Continue</button>' : ''}
        <button id="newbtn" ${hasAuto ? '' : 'class="primary"'}>New campaign</button>
        ${has ? '<button id="loadbtn">Load saved campaign</button>' : ''}
        <button id="tutbtn">Tutorial</button>
        <button id="practbtn">Practice battle</button>
        <button id="helpbtn">How to play</button>
      </div></div>`;
    $('#start').hidden = false;
    startMarch();
    $('#newbtn').onclick = showNations;
    $('#helpbtn').onclick = showHelp;
    $('#tutbtn').onclick = startTutorial;
    $('#practbtn').onclick = startPractice;
    if (has) $('#loadbtn').onclick = () => loadGame(SAVE_KEY);
    if (hasAuto) $('#autobtn').onclick = () => loadGame(AUTOSAVE_KEY);
    if (!ui.seenIntro && !lsGet('napworld-seen')) {
      ui.seenIntro = true;
      try { localStorage.setItem('napworld-seen', '1'); } catch (e) {}
      modal(`<h2>Welcome to Savage Napoleonic War Simulation</h2>${NAP.guide.eventArt({ art: 'flags' })}<div class="body"><p style="font-size:15px">Europe, 1805. Napoleon stands at the head of France, Britain funds coalition after coalition, and the old crowns of Austria, Russia and Prussia prepare to fight. Take any of twelve nations through the Napoleonic Wars with a turn-based campaign map and real-time battles.</p><p>New here? The short guided tutorial teaches the controls in a few minutes.</p></div><div class="foot"><button data-r="no">I'll figure it out</button><button class="primary" data-r="yes">Start the tutorial</button></div>`, 'event').then((r) => { if (r === 'yes') startTutorial(); });
    }
  }

  function beginGame(f, noNaval) {
    ui.tut = { on: false, step: 0 }; ui.dipOpened = false;
    if (NAP.audio) { NAP.audio.init(); NAP.audio.music('map'); }
    C.newGame(f, ui.difficulty, { naval: !!ui.naval && !noNaval });
    enterGame();
    const cap = NAP.world.byId[S().factions[f].cap];
    ui.cam = { x: cap.cx, y: cap.cy, z: 1.15 }; ui.zt = null;
    ui.sel = { prov: cap.id, army: null };
    refresh();
  }
  function enterGame() {
    $('#start').hidden = true; $('#game').hidden = false;
    $('#loglist').innerHTML = '';
    S().log.slice(-12).forEach((l) => pushLog(l.text, l.kind, l.t));
    resize(); dirty = true;
  }
  function saveGame() { try { localStorage.setItem(SAVE_KEY, C.serialize()); toast('Game saved'); } catch (e) { toast('Could not save'); } }
  function loadGame(key) {
    try { C.deserialize(lsGet(key || SAVE_KEY)); enterGame(); const f = S().player; const cap = NAP.world.byId[S().factions[f].cap]; ui.cam = { x: cap.cx, y: cap.cy, z: 1.1 }; ui.zt = null; ui.sel = { prov: null, army: null }; refresh(); toast('Game loaded'); }
    catch (e) { console.error(e); toast('Save is corrupted'); }
  }

  // ------------------------------------------------------------------ top bar
  function renderTop() {
    const s = S(), p = s.player, fs = s.factions[p];
    const inc = C.factionIncome(p), up = C.factionUpkeep(p), net = inc - up;
    const provs = C.provincesOf(p).length, total = NAP.world.provs.length;
    const att = C.attention(p);
    const at = C.warsOf(p).filter((x) => x !== 'minor' || true).map((x) => F(x).adj);
    $('#topbar').innerHTML = `
      <span class="flag" style="background:${F(p).color}"></span><span class="fname">${esc(F(p).name)}</span>
      <span class="stat" title="Treasury / net per turn (income ${fmt(inc)} - upkeep ${fmt(up)})">&#128176; <b>${fmt(fs.gold)}</b> <small class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${fmt(net)}</small> <small>(${fmt(inc)} − ${fmt(up)})</small></span>
      <span class="stat" title="Manpower pool / monthly growth">&#128100; <b>${fmt(fs.manpower)}</b> <small>+${fmt(C.manpowerGain(p))}</small></span>
      <span class="stat" title="Provinces held; win at 55%">&#9873; <b>${provs}</b><small>/${total}</small></span>
      ${s.naval ? '' : '<!--'}<span class="stat" title="Ships in your navy">&#9875; <b>${C.fleetsOf(p).reduce((a, x) => a + C.shipCount(x), 0)}</b> <small>ships</small></span>${s.naval ? '' : '-->'}
      <span class="stat" title="Armies">&#9876; <b>${C.armiesOf(p).reduce((a, x) => a + x.units.length, 0)}</b> <small>regts</small></span>
      <span class="stat" title="At war with">${at.length ? `<span class="bad" title="${esc(at.join(', '))}">War${at.length <= 2 ? ': ' + at.join(', ') : ' × ' + at.length}</span>` : '<span class="good">At peace</span>'}</span>
      <span class="spacer"></span>
      <button id="b-att" class="${att.length ? 'attn' : ''}" data-tip="<b>Needs attention</b><br>Idle armies, supply trouble, unrest, sieges and unspent gold.">&#9873; ${att.length}</button><select id="playsel" title="Turn playback: watch each nation's moves in turn"><option value="normal">Playback: normal</option><option value="fast">Playback: fast</option><option value="off">Playback: off</option></select><button id="b-dip">Diplomacy</button><button id="b-ov">Overview</button><button id="b-snd" data-nosound="1" title="Sound on/off">${NAP.audio && NAP.audio.muted ? '&#128263;' : '&#128266;'}</button><button id="b-help" title="How to play">?</button><button id="b-save">Save</button><button id="b-menu">Menu</button>
      <span class="date">${C.dateStr()}</span>
      <button id="advance" ${s.busy || s.winner ? 'disabled' : ''} data-tip="<b>Advance (fast-forward)</b><br>Ends turns automatically (up to 6) until something needs your attention: a battle, a lost province, an idle army or supply trouble.">&#9654;&#9654;</button><button class="primary" id="endturn" ${s.busy || s.winner ? 'disabled' : ''}>End Turn <kbd>Enter</kbd></button>`;
    $('#b-snd').onclick = () => { NAP.audio.init(); NAP.audio.setMuted(!NAP.audio.muted); renderTop(); };
    $('#b-help').onclick = showHelp; $('#b-dip').onclick = showDiplomacy; $('#b-ov').onclick = showOverview; $('#b-save').onclick = saveGame;
    $('#b-menu').onclick = async () => { if (await modal(`<h2>Menu</h2><div class="body">Return to the main menu? Unsaved progress will be lost.</div><div class="foot"><button data-r="no">Cancel</button><button class="danger" data-r="yes">Quit to menu</button></div>`) === 'yes') showStart(); };
    $('#endturn').onclick = () => endTurn();
    $('#advance').onclick = advance;
    $('#playsel').value = ui.playback; $('#playsel').onchange = (e) => { ui.playback = e.target.value; try { localStorage.setItem('napworld-playback', ui.playback); } catch (x) {} };
    $('#b-att').onclick = showAttention;
  }

  async function showAttention() {
    const list = C.attention(S().player);
    const html = `<h2>Needs attention</h2><div class="body">${list.length ? list.map((x, i) => `<div class="attrow sev${x.sev}"><span>${esc(x.text)}</span><button data-r="${i}">Go</button></div>`).join('') : '<p class="muted">Nothing urgent. All armies have orders and no province is in trouble.</p>'}</div><div class="foot"><button data-r="x">Close</button></div>`;
    const r = await modal(html);
    if (r === null || r === 'x' || list[+r] === undefined) return;
    focusAttention(list[+r]);
  }
  function focusAttention(x) {
    const p = NAP.world.byId[x.prov]; if (!p) return;
    ui.cam.x = p.cx; ui.cam.y = p.cy; ui.cam.z = Math.max(ui.cam.z, 1.2); ui.zt = null; clampCam();
    ui.sel = { prov: x.prov, army: x.army || null };
    ui.pulseProv = x.prov; setTimeout(() => { if (ui.pulseProv === x.prov) { ui.pulseProv = null; dirty = true; } }, 2500);
    refresh();
  }
  async function endTurn(skipWarn) {
    const s = S();
    if (s.busy || s.winner) return;
    if (!skipWarn && !ui.noIdleWarn && !(ui.tut && ui.tut.on)) {
      const idle = C.attention(s.player).filter((x) => x.kind === 'idle' || x.kind === 'supply');
      if (idle.length) {
        const r = await modal(`<h2>Armies awaiting orders</h2><div class="body">${idle.slice(0, 6).map((x, i) => `<div class="attrow"><span>${esc(x.text)}</span><button data-r="g${i}">Go</button></div>`).join('')}<label class="muted" style="display:block;margin-top:10px"><input type="checkbox" id="idlewarn"> Don't warn me again</label></div><div class="foot"><button data-r="no">Review</button><button class="primary" data-r="yes">End turn anyway</button></div>`);
        const chk = $('#idlewarn'); if (chk && chk.checked) ui.noIdleWarn = true;
        if (r && r[0] === 'g') { focusAttention(idle[+r.slice(1)]); return; }
        if (r !== 'yes') return;
      }
    }
    await turnCore();
    if (!s.winner) await showSummary();
    if (s.winner) await showEnd(s.winner);
    refresh();
  }
  async function turnCore() {
    const s = S();
    $('#endturn').disabled = true; $('#endturn').textContent = 'Processing…';
    ui.sel.army = ui.sel.army && s.armies.find((a) => a.id === ui.sel.army) ? ui.sel.army : null;
    if (NAP.audio) NAP.audio.sfx('roll');
    try { await C.endTurn(); } catch (e) { console.error(e); toast('Error: ' + e.message); s.busy = false; }
    try { localStorage.setItem(AUTOSAVE_KEY, C.serialize()); } catch (e) { /* storage full or blocked */ }
    refresh();
  }
  // end turns until something needs the player
  async function advance() {
    const s = S();
    if (s.busy || s.winner) return;
    ui.skipPhase = true;
    for (let i = 0; i < 6; i++) {
      await turnCore();
      if (s.winner) break;
      const sm = s.summary || { entries: [], gained: [], lost: [] };
      const key = sm.gained.length || sm.lost.length || sm.entries.some((e) => /battle|captur|besiege|revolt|storm|war on|peace|alliance/i.test(e.text) && !(e.kind || '').endsWith('-minor'));
      const urgent = C.attention(s.player).filter((x) => x.sev >= 2);
      if (key || urgent.length) { if (urgent.length) focusAttention(urgent[0]); break; }
    }
    ui.skipPhase = false;
    if (!s.winner) await showSummary();
    if (s.winner) await showEnd(s.winner);
    refresh();
  }

  // ---- end-of-turn summary
  async function showSummary() {
    const s = S(), sm = s.summary;
    if (!sm || lsGet(SUMMARY_KEY) === '1' || (ui.tut && ui.tut.on)) return;
    const entries = sm.entries.filter((e) => !(e.kind || '').endsWith('-minor') && e.kind !== 'info' || /captur|besiege|battle|revolt|storm/i.test(e.text) && !(e.kind || '').endsWith('-minor'));
    const gained = sm.gained.map((id) => NAP.world.byId[id].name), lost = sm.lost.map((id) => NAP.world.byId[id].name);
    if (!entries.length && !gained.length && !lost.length) return;
    const net = sm.income - sm.upkeep;
    const html = `<h2>${esc(sm.date)} — Report</h2><div class="body">
      <div class="sumrow"><span>Treasury</span><b>${fmt(sm.gold0)} → ${fmt(sm.gold1)}</b></div>
      <div class="sumrow"><span>Income / upkeep (next month)</span><b>${fmt(sm.income)} / ${fmt(sm.upkeep)} <span class="${net >= 0 ? 'good' : 'bad'}">(${net >= 0 ? '+' : ''}${fmt(net)})</span></b></div>
      ${gained.length ? `<div class="sumrow"><span class="good">Provinces gained</span><b>${esc(gained.join(', '))}</b></div>` : ''}
      ${lost.length ? `<div class="sumrow"><span class="bad">Provinces lost</span><b>${esc(lost.join(', '))}</b></div>` : ''}
      <div class="sumlist">${entries.map((e) => `<div class="k-${e.kind}">${esc(e.text)}</div>`).join('') || '<div class="muted">A quiet month.</div>'}</div>
      </div><div class="foot"><label class="muted" style="margin-right:auto"><input type="checkbox" id="sumoff"> Don't show reports</label><button class="primary" data-r="ok">Continue</button></div>`;
    const p = modal(html);
    $('#sumoff').onchange = (e) => { try { localStorage.setItem(SUMMARY_KEY, e.target.checked ? '1' : '0'); } catch (x) {} };
    await p;
  }

  async function showEnd(v) {
    const s = S();
    const html = `<h2>${v.won ? 'Victory' : 'The End'}</h2><div class="body"><p style="font-size:16px">${esc(v.reason)}</p>
      <p class="muted">Final standing after ${s.turn} turns (${C.dateStr()}).</p></div>
      <div class="foot">${v.ended || v.won ? '<button data-r="cont">Keep playing</button>' : ''}<button class="primary" data-r="menu">Main menu</button></div>`;
    const r = await modal(html, 'event');
    if (r === 'cont') { s.winner = null; s.noVictory = true; } else showStart();
  }

  // ------------------------------------------------------------------ side panel
  function provTip(p) {
    const s = S(), ps = s.provinces[p.id], d = NAP.world.byId[p.id];
    let h = `<b>${p.capital ? '\u2605 ' : ''}${esc(p.name)}</b> \u2014 ${esc(F(ps.owner).adj)}<br><span class="ttk">${{ p: 'Plains', h: 'Hills', f: 'Forest', m: 'Mountains' }[p.terrain]}${p.port ? ' \u00B7 Port' : ''} \u00B7 Income ${fmt(C.provIncome(ps))} \u00B7 Manpower ${C.def(p.id).manpower}</span>`;
    if ((ps.unrest || 0) > 5) h += `<br><span class="${ps.unrest >= 60 ? 'bad' : 'warn'}">Unrest ${Math.round(ps.unrest)}%</span>`;
    const bl = ['market', 'barracks', 'stables', 'arsenal', 'academy'].filter((b) => ps[b]).map((b) => NAP.BUILDINGS[b].name); if (ps.fort) bl.push('Fort ' + ps.fort);
    if (bl.length) h += `<br><span class="ttk">${bl.join(', ')}</span>`;
    const ar = s.armies.filter((a) => a.prov === p.id); if (ar.length) h += '<br>' + ar.map((a) => `${esc(F(a.owner).adj)} army (${a.units.length} regts)`).join('<br>');
    const fh = (s.fleets || []).filter((x) => x.port === p.id); if (fh.length) h += '<br>' + fh.map((x) => `${esc(F(x.owner).adj)} fleet (${C.shipCount(x)} ships)`).join('<br>');
    if (ps.blockade) h += '<br><span class="bad">Blockaded</span>';
    if (ps.siege) h += `<br><span class="bad">Besieged by ${esc(F(ps.siege.by).adj)}</span>`;
    return h;
  }
  const dots = (v, max) => '\u25CF'.repeat(Math.max(0, Math.min(max, v))) + '\u25CB'.repeat(max - Math.max(0, Math.min(max, v)));
  function unitTip(t, ps, err, cost) {
    const u = U[t], bt = (NAP.BT || {})[t] || {};
    const fire = u.cls === 'cav' ? 0 : u.cls === 'art' ? (t === 'hart' ? 4 : 5) : Math.round((bt.fire || 0) / 0.0085 * 5);
    const melee = Math.max(1, Math.round((bt.melee || 0) / 0.009 * 5));
    let h = `<b>${u.name}</b><br>${u.desc}<br><span class="ttk">Men ${u.men} \u00B7 Cost ${cost}g \u00B7 Upkeep ${u.upkeep}/turn \u00B7 Trains in ${u.time} turn${u.time > 1 ? 's' : ''}</span>`;
    h += `<br><span class="ttk">Firepower ${dots(fire, 5)} \u00B7 Melee ${dots(melee, 5)} \u00B7 Morale ${u.morale} \u00B7 Speed ${u.speed}</span>`;
    if (u.needs) h += `<br>${ps[u.needs] ? '\u2714' : '\u{1F512}'} Needs a <b>${NAP.BUILDINGS[u.needs].name}</b> in this province.`;
    if (ps.academy) h += '<br>\u2605 Raised as veterans (Military Academy).';
    if (u.cls === 'art' && ps.arsenal) h += '<br>Arsenal: 20% cheaper.'; if (u.cls === 'cav' && ps.stables) h += '<br>Stables: 10% cheaper.';
    if (err && !String(err).startsWith('Requires')) h += `<br><span class="bad">${err}</span>`;
    return h;
  }
  function buildingTip(b, ps, err) {
    const bd = NAP.BUILDINGS[b], d = NAP.world.byId[ps.id];
    let h = `<b>${bd.name}</b><br>${bd.desc}<br><span class="ttk">Cost ${bd.cost}g \u00B7 Build time ${bd.time} turns</span>`;
    if (b === 'market') h += `<br>In this province: about <b>+${Math.round(d.income * 8 * 0.5)} gold</b> per turn.`;
    if (b === 'barracks') h += `<br>In this province: about <b>+${Math.round(d.manpower * 25 * 0.5)} men</b> per turn.`;
    const unlocks = Object.keys(U).filter((t) => U[t].needs === b).map((t) => U[t].name);
    if (unlocks.length) h += `<br>Unlocks: <b>${unlocks.join(', ')}</b>`;
    const needed = Object.keys(NAP.BUILDINGS).filter((k) => NAP.BUILDINGS[k].req === b).map((k) => NAP.BUILDINGS[k].name);
    if (needed.length) h += `<br>Required for: ${needed.join(', ')}`;
    if (bd.req) h += `<br>${ps[bd.req] ? '\u2714' : '\u{1F512}'} Requires <b>${NAP.BUILDINGS[bd.req].name}</b> first.`;
    if (b === 'fort') h += `<br>Currently level ${ps.fort} of ${bd.max}.`;
    if (err) h += `<br><span class="${err === 'Already built' ? 'good' : 'bad'}">${err}</span>`;
    return h;
  }

  function renderSide() {
    const el = $('#side'), s = S();
    const army = ui.sel.army ? s.armies.find((a) => a.id === ui.sel.army) : null;
    if (ui.sel.army && !army) ui.sel.army = null;
    const fleet = selFleet(); if (ui.sel.fleet && !fleet) ui.sel.fleet = null;
    const pid = army ? army.prov : fleet && fleet.port ? fleet.port : ui.sel.prov;
    if (!pid && fleet) { el.innerHTML = fleetPanel(fleet); bindFleetPanel(fleet); return; }
    if (!pid) { el.innerHTML = `<div class="sec"><h4>Europe, ${C.dateStr()}</h4><p class="muted">Click a province or an army to see details. Right-click a destination to move the selected army.</p>${standings()}</div>`; return; }
    const p = NAP.world.byId[pid], ps = s.provinces[pid], owner = ps.owner, mine = owner === s.player;
    const armies = s.armies.filter((a) => a.prov === pid);
    let html = `<div class="ph" style="--c:${F(owner).color}"><h2>${p.capital ? '★ ' : ''}${esc(p.name)}</h2><div class="own">${esc(F(owner).name)} · ${{ p: 'Plains', h: 'Hills', f: 'Forest', m: 'Mountains' }[p.terrain]}${p.port ? ' · Port' : ''}</div></div>`;
    if (army) html += armyPanel(army);
    const fleetsHere = (s.fleets || []).filter((x) => x.port === pid);
    if (fleet) html += fleetPanel(fleet);
    else if (fleetsHere.length) html += `<div class="sec"><h4>Fleets here</h4>${fleetsHere.map((x) => `<div class="armychip" data-fleet="${x.id}"><i style="background:${F(x.owner).color}"></i><span>${esc(F(x.owner).adj)} fleet \u00B7 ${C.shipCount(x)} ships</span></div>`).join('')}</div>`;
    html += `<div class="sec"><h4>Province</h4>
      <div class="kv"><span>Income</span><b>${fmt(C.provIncome(ps))}/turn</b></div>
      <div class="kv"><span>Manpower</span><b>+${fmt(p.manpower * 25 * (1 + 0.5 * ps.barracks))}/turn</b></div>
      <div class="kv"><span>Fortification</span><b>${ps.fort ? '♖'.repeat(ps.fort) : 'None'}</b></div>
      <div class="kv"><span>Buildings</span><b style="text-align:right">${Object.keys(NAP.BUILDINGS).filter((b) => b !== 'fort' && ps[b]).map((b) => NAP.BUILDINGS[b].name).join(', ') || '—'}</b></div>
      <div class="kv"><span>Unrest</span><b class="${(ps.unrest || 0) >= 60 ? 'bad' : (ps.unrest || 0) >= 30 ? 'warn' : ''}">${Math.round(ps.unrest || 0)}%</b></div><div class="bar"><i style="width:${Math.round(ps.unrest || 0)}%"></i></div>
      ${!mine && C.atWar(s.player, owner) ? `<div class="kv"><span>Garrison</span><b>~${fmt(C.garrisonStrength(pid))} men</b></div>` : ''}
      ${ps.blockade ? `<div class="kv bad"><span>Port blockaded</span><b>income halved</b></div>` : ''}
      ${ps.siege ? `<div class="kv bad"><span>Under siege</span><b>${ps.siege.progress}/${ps.fort + 1}</b></div>` : ''}</div>`;
    if (armies.length) {
      html += `<div class="sec"><h4>Armies here</h4>${armies.map((a) => `<div class="armychip ${army && a.id === army.id ? 'sel' : ''}" data-army="${a.id}"><i style="background:${F(a.owner).color}"></i><span>${esc(F(a.owner).adj)} · ${a.units.length} regts · ${fmt(C.armyMen(a))} men${a.general ? ' · ★ ' + esc(s.generals[a.general].name) : ''}</span></div>`).join('')}</div>`;
    }
    if (mine) {
      html += `<div class="sec"><h4>Policy</h4><select id="polpick" style="width:100%"><option value="balanced">Balanced</option><option value="tax">Heavy taxation (+25% gold, unrest rises)</option><option value="levy">Conscription (+50% manpower, −15% gold)</option><option value="order">Martial order (unrest falls, −15% gold)</option></select></div>`;
      const unitRow = (t) => {
        const u = U[t], err = C.recruitCheck(pid, t), cost = C.unitCost(pid, t), lock = u.needs && !ps[u.needs];
        return `<button class="ubtn${err ? ' locked' : ''}" data-rec="${t}" data-tip="${esc(unitTip(t, ps, err, cost))}"><span>${lock ? '\u{1F512} ' : ''}${u.name} <small class="muted">(${u.men})</small></span><span>${lock ? 'needs ' + NAP.BUILDINGS[u.needs].name : cost + 'g \u00B7 ' + u.time + 't'}</span></button>`;
      };
      html += `<div class="sec" data-fold="recruit"><h4>Recruit <span class="qm" data-tip="Raise regiments here. Standard troops are always available; elite troops need a building in this province. Hover a unit for its role and stats.">?</span></h4>`;
      html += Object.keys(U).filter((t) => !U[t].needs).map(unitRow).join('');
      html += `<div class="subh">Elite troops (need buildings)</div>` + Object.keys(U).filter((t) => U[t].needs).map(unitRow).join('');
      if (ps.queue.length) html += `<div class="queue">In training: ${ps.queue.map((q) => U[q.type].short + ' (' + q.left + ')').join(', ')}</div>`;
      html += `</div><div class="sec" data-fold="build"><h4>Construction <span class="qm" data-tip="Buildings are permanent upgrades to this province. Hover each one to see what it does and which troops it unlocks.">?</span></h4>`;
      for (const b of Object.keys(NAP.BUILDINGS)) {
        if (NAP.BUILDINGS[b].port && (!p.port || !s.naval)) continue;
        const bd = NAP.BUILDINGS[b], built = b === 'fort' ? ps.fort >= bd.max : ps[b] >= 1, err = C.buildCheck(pid, b);
        html += `<button class="ubtn${err ? ' locked' : ''}" data-bld="${b}" data-tip="${esc(buildingTip(b, ps, err))}"><span>${built && b !== 'fort' ? '\u2714 ' : ''}${bd.name}${b === 'fort' ? ' ' + ps.fort + '/' + bd.max : ''}</span><span>${built && b !== 'fort' ? 'built' : bd.cost + 'g \u00B7 ' + bd.time + 't'}</span></button>`;
      }
      if (ps.build) html += `<div class="queue">Building ${NAP.BUILDINGS[ps.build.type].name} (${ps.build.left} turns)</div>`;
      html += `</div>`;
      if (p.port && s.naval) {
        html += `<div class="sec" data-fold="navy"><h4>Navy <span class="qm" data-tip="Ships are built at a Shipyard in a port. Fleets sail between five sea zones, fight enemy fleets automatically, blockade enemy ports and escort your armies across the sea.">?</span></h4>`;
        html += Object.keys(NAP.SHIPS).map((t) => { const sh = NAP.SHIPS[t], err = C.shipCheck(pid, t); return `<button class="ubtn${err ? ' locked' : ''}" data-ship="${t}" data-tip="${esc('<b>' + sh.name + '</b><br>' + sh.desc + '<br><span class="ttk">Crew ' + sh.men + ' \u00B7 Cost ' + C.shipCost(pid, t) + 'g \u00B7 Upkeep ' + sh.upkeep + '/turn \u00B7 Builds in ' + sh.time + ' turns \u00B7 Fleet strength ' + sh.power + '</span>' + (err ? '<br><span class="bad">' + err + '</span>' : ''))}"><span>${!ps.shipyard ? '\u{1F512} ' : ''}${sh.name} <small class="muted">(${sh.men} crew)</small></span><span>${!ps.shipyard ? 'needs Shipyard' : C.shipCost(pid, t) + 'g \u00B7 ' + sh.time + 't'}</span></button>`; }).join('');
        if ((ps.shipQueue || []).length) html += `<div class="queue">On the slips: ${ps.shipQueue.map((q) => NAP.SHIPS[q.type].short + ' (' + q.left + ')').join(', ')}</div>`;
        html += `</div>`;
      }
    } else if (owner !== 'minor' || true) {
      const war = C.atWar(s.player, owner);
      html += `<div class="sec"><h4>Diplomacy</h4><div class="kv"><span>Relations</span><b>${C.rel(s.player, owner) > 0 ? '+' : ''}${Math.round(C.rel(s.player, owner))}</b></div>
        <div class="row">${war ? '<span class="bad">At war</span>' : C.allied(s.player, owner) ? '<span class="good">Allied</span>' : `<button data-war="${owner}" class="danger">Declare war on ${esc(F(owner).adj)}</button>`}</div></div>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-fold]').forEach((sec) => {
      const k = sec.dataset.fold, forced = ui.tut && ui.tut.on;
      sec.classList.toggle('folded', !forced && (k in ui.folds ? ui.folds[k] : k !== 'recruit'));
      sec.querySelector('h4').onclick = (e) => { if (e.target.closest('.qm')) return; sec.classList.toggle('folded'); ui.folds[k] = sec.classList.contains('folded'); };
    });
    el.querySelectorAll('[data-army]').forEach((e) => (e.onclick = () => { ui.sel.army = +e.dataset.army; ui.sel.fleet = null; refresh(); }));
    el.querySelectorAll('[data-fleet]').forEach((e) => (e.onclick = () => { ui.sel.fleet = +e.dataset.fleet; ui.sel.army = null; refresh(); }));
    el.querySelectorAll('[data-ship]').forEach((b) => (b.onclick = () => { const e = C.buildShip(pid, b.dataset.ship); if (e) toast(e); refresh(); }));
    if (fleet) bindFleetPanel(fleet);
    el.querySelectorAll('[data-rec]').forEach((b) => (b.onclick = () => { const e = C.recruit(pid, b.dataset.rec); if (e) toast(e); refresh(); }));
    el.querySelectorAll('[data-bld]').forEach((b) => (b.onclick = () => { const e = C.build(pid, b.dataset.bld); if (e) toast(e); refresh(); }));
    el.querySelectorAll('[data-war]').forEach((b) => (b.onclick = async () => {
      const f = b.dataset.war;
      if (await modal(`<h2>Declare war?</h2><div class="body">Declare war on the ${esc(F(f).name)}? Their allies may join the conflict.</div><div class="foot"><button data-r="no">Cancel</button><button class="danger" data-r="yes">Declare war</button></div>`) === 'yes') { C.declareWar(s.player, f); refresh(); }
    }));
    const pp = $('#polpick'); if (pp) { pp.value = ps.policy || 'balanced'; pp.onchange = () => { C.setPolicy(pid, pp.value); refresh(); }; }
    bindArmyPanel(army);
    applyHighlights();
  }

  function standings() {
    const s = S();
    const rows = Object.keys(s.factions).filter((f) => s.factions[f].alive && f !== 'minor').map((f) => ({ f, n: C.provincesOf(f).length, p: C.factionPower(f) })).sort((a, b) => b.n - a.n);
    return `<h4 style="margin-top:12px">Great Powers</h4><table class="t"><tr><th>Power</th><th>Prov</th><th>Army</th></tr>${rows.map((r) => `<tr><td>${flag(r.f)}${esc(F(r.f).adj)}</td><td>${r.n}</td><td>${fmt(r.p / 1000)}k</td></tr>`).join('')}</table>`;
  }

  function fleetPanel(fl) {
    const mine = fl.owner === S().player, n = C.shipCount(fl);
    let html = `<div class="sec"><h4>${esc(F(fl.owner).adj)} fleet \u00B7 ${n} ship${n > 1 ? 's' : ''}</h4>`;
    html += `<div class="kv"><span>Location</span><b>${esc(C.fleetLabel(fl))}</b></div><div class="kv"><span>Fleet strength</span><b>${Math.round(C.fleetPower(fl) * 10) / 10}</b></div>`;
    html += Object.keys(NAP.SHIPS).filter((t) => fl.ships[t]).map((t) => `<div class="kv"><span>${esc(NAP.SHIPS[t].name)}</span><b>${fl.ships[t]}</b></div>`).join('');
    if (fl.path.length) { const last = fl.path[fl.path.length - 1].split(':'); html += `<div class="kv"><span>Sailing to</span><b>${esc(last[0] === 'z' ? NAP.SEA_ZONES[+last[1]].name : NAP.world.byId[last[1]].name)} (${fl.path.length})</b></div>`; }
    if (mine) {
      const dests = C.fleetDestinations(fl);
      html += `<div class="row"><select id="fleetgo" style="width:100%"><option value="">Sail to\u2026</option>${dests.map((d) => `<option value="${d.node}">${esc(d.label)} \u2014 ${d.turns} turn${d.turns > 1 ? 's' : ''}</option>`).join('')}</select></div>`;
      html += `<div class="row"><button data-fact="stop">Hold position</button></div>`;
      html += `<p class="muted" style="font-size:12px;margin:6px 0 0">At sea with no enemy fleet present: you blockade enemy ports in the zone (halving their income) and your armies may sail through it. Fleets in the same zone as an enemy fleet fight automatically. Right-click a ring or port on the map to sail.</p>`;
    }
    return html + '</div>';
  }
  function bindFleetPanel(fl) {
    if (!fl || fl.owner !== S().player) return;
    const g = $('#fleetgo');
    if (g) g.onchange = () => { if (!g.value) return; if (C.orderFleet(fl, g.value)) toast(`Sailing: ${fl.path.length} turn${fl.path.length > 1 ? 's' : ''}`); else toast('No route there'); refresh(); };
    const st = $('#side').querySelector('[data-fact=stop]'); if (st) st.onclick = () => { fl.path = []; refresh(); };
  }
  function armyPanel(a) {
    const s = S(), mine = a.owner === s.player, g = a.general ? s.generals[a.general] : null;
    let html = `<div class="sec"><h4>${esc(F(a.owner).adj)} army · ${a.units.length}/${C.stackLimit} regiments</h4>`;
    if (g) html += `<div class="gen"><b>★ ${esc(g.name)}</b> <span class="muted">Lv${g.lvl}</span><br>ATK ${g.atk} · DEF ${g.def} · LEAD ${g.lead} <span class="muted">— ${esc(g.trait)}</span><br>${(g.traits || []).map((t) => `<span class="tag peace" data-tip="${esc(NAP.TRAITS[t].desc)}">${esc(NAP.TRAITS[t].name)}</span>`).join(' ')} <span class="${(g.loyalty || 70) < 40 ? 'bad' : 'muted'}" data-tip="Loyalty rises with commands and victories. Idle or overlooked generals grow bitter and may retire.">Loyalty ${Math.round(g.loyalty || 70)}</span></div>`;
    else html += `<div class="gen muted">No general appointed</div>`;
    html += `<div class="kv"><span>Strength</span><b>${fmt(C.armyMen(a))} men</b></div>`;
    const dpt = C.supplyDepth(a);
    html += `<div class="kv"><span>Fatigue</span><b class="${(a.fatigue || 0) > 50 ? 'bad' : (a.fatigue || 0) > 20 ? 'warn' : ''}">${Math.round(a.fatigue || 0)}%</b></div><div class="kv"><span>Supply</span><b class="${dpt >= 2 ? 'bad' : dpt === 1 ? 'warn' : 'good'}">${dpt === 0 ? 'At home' : dpt === 1 ? 'Foraging' : dpt === 2 ? 'Strained' : 'Cut off'}</b></div>`;
    if (a.path.length) html += `<div class="kv"><span>Destination</span><b>${esc(NAP.world.byId[a.path[a.path.length - 1]].name)} (${a.path.length})</b></div>`;
    html += `<div style="margin-top:6px">`;
    a.units.forEach((u, i) => {
      html += `<div class="unit"><input type="checkbox" data-u="${i}" ${mine ? '' : 'disabled'}><span>${U[u.type].name}${C.canUpgrade(u) ? ' <span class="good" title="Ready to upgrade to Line Infantry">\u25B2</span>' : ''}${C.vetOf(u) ? ' <span class="gold">' + '\u2605'.repeat(C.vetOf(u)) + '</span>' : ''}</span><span style="text-align:right">${u.men}/${u.max}</span><div class="bar"><i style="width:${Math.round(u.men / u.max * 100)}%"></i></div></div>`;
    });
    html += `</div>`;
    if (mine) {
      const sErr = C.assaultCheck(a);
      html += `<div class="row"><label><input type="checkbox" data-act="forced" ${a.forced ? 'checked' : ''}> Forced march <span class="muted">(2 provinces/turn, −3% men, +fatigue)</span></label></div>`;
      const up = a.units.map((u, i) => (C.canUpgrade(u) ? i : -1)).filter((i) => i >= 0);
      if (up.length) html += `<div class="row"><button data-act="upmil" class="primary" data-tip="Battle-hardened militia are drilled into Line Infantry for free (keeps veteran stars and current strength ratio).">Upgrade ${up.length} militia \u2192 Line (free)</button></div>`;
      html += `<div class="row"><label data-tip="Living off the land: fewer losses from supply shortage, but the province is stripped and angered (unrest +8, income cut next month)."><input type="checkbox" data-act="forage" ${a.forage ? 'checked' : ''}> Forage <span class="muted">(fewer losses, ruins the province)</span></label></div>`;
      html += `<div class="row"><select id="staffpick" data-tip="Staff officers cost gold once and a little upkeep each turn."><option value="">${a.staff ? 'Staff: ' + esc(NAP.STAFF[a.staff].name) + ' (change)' : 'Hire staff officer\u2026'}</option>${Object.keys(NAP.STAFF).filter((k) => k !== a.staff).map((k) => `<option value="${k}">${esc(NAP.STAFF[k].name)} \u2014 ${NAP.STAFF[k].cost}g: ${esc(NAP.STAFF[k].desc)}</option>`).join('')}${a.staff ? '<option value="none">Dismiss staff officer</option>' : ''}</select></div>`;
      if (!sErr) html += `<div class="row"><button data-act="storm" class="danger" title="Garrison about ${C.garrisonStrength(a.prov)} men">Storm the walls</button></div>`;
      html += `<div class="row"><button data-act="split">Split selected</button><button data-act="merge">Merge here</button><button data-act="stop">Halt</button><button data-act="disband" class="danger">Disband</button></div>`;
      const pool = C.availableGenerals(s.player);
      if (pool.length) html += `<div class="row"><select id="genpick"><option value="">Appoint general…</option>${pool.map((x) => `<option value="${x.id}">${esc(x.name)} (${x.atk}/${x.def}/${x.lead})</option>`).join('')}</select></div>`;
      if (g) html += `<div class="row"><button data-act="relieve">Relieve general</button></div>`;
    }
    return html + '</div>';
  }
  function bindArmyPanel(a) {
    if (!a || a.owner !== S().player) return;
    const el = $('#side'), checked = () => [...el.querySelectorAll('[data-u]:checked')].map((c) => +c.dataset.u);
    el.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
      const act = b.dataset.act;
      if (act === 'forced') { a.forced = b.checked; return; }
      if (act === 'forage') { a.forage = b.checked; return; }
      if (act === 'upmil') { let n = 0; a.units.forEach((u, i) => { if (C.upgradeMilitia(a, i)) n++; }); toast(`${n} militia upgraded to Line Infantry`); }
      if (act === 'split') { const idx = checked(); if (!idx.length || idx.length >= a.units.length) return toast('Select some (not all) regiments'); const na = C.splitArmy(a, idx); if (na) ui.sel.army = na.id; }
      else if (act === 'merge') { const others = S().armies.filter((x) => x !== a && x.prov === a.prov && x.owner === a.owner); let n = 0; others.forEach((o) => { if (C.mergeArmies(a, o)) n++; }); toast(n ? `Merged ${n} army` : 'Nothing to merge (stack limit?)'); }
      else if (act === 'stop') a.path = [];
      else if (act === 'forced') { a.forced = b.checked; }
      else if (act === 'storm') { const r = C.assault(a); toast(r.text); }
      else if (act === 'disband') { const idx = checked(); if (!idx.length) return toast('Tick regiments to disband'); idx.sort((x, y) => y - x).forEach((i) => C.disbandUnit(a, i)); if (!S().armies.includes(a)) ui.sel.army = null; }
      else if (act === 'relieve') { const gid = a.general; if (gid) { S().generals[gid].assigned = null; S().pool[S().generals[gid].owner].push(gid); a.general = null; } }
      refresh();
    }));
    const sp = $('#staffpick');
    if (sp) sp.onchange = () => { if (!sp.value) return; const e = C.setStaff(a, sp.value === 'none' ? null : sp.value); if (e) toast(e); refresh(); };
    const gp = $('#genpick');
    if (gp) gp.onchange = () => { if (gp.value) { C.assignGeneral(a, +gp.value); refresh(); } };
  }

  // ------------------------------------------------------------------ dialogs
  async function showHelp() {
    await modal(`<h2>How to play</h2><div class="body" style="font-size:13.5px;line-height:1.55">
      <p><b>Goal:</b> hold 55% of Europe's provinces (or eliminate every rival power). Survive to the end of 1815 for a score by territory. One turn is one month.</p>
      <p><b>Campaign map:</b> left-click a province or an army (the small flag) to select it. With an army selected, <b>right-click</b> a destination to give a march order &mdash; armies advance one province per turn; a dashed line previews the route. Armies of up to 12 regiments can cross the sea between ports (dashed lines show the routes) \u2014 a pure supply-and-transport abstraction, there are no fleets. Enemy provinces must be besieged: fortified ones take several turns, and artillery speeds sieges up.</p>
      <p><b>Economy:</b> provinces produce gold and manpower. Recruit regiments and build Markets, Barracks and Fortifications from the province panel. Regiments cost gold to raise and upkeep every month &mdash; go bankrupt and they desert. Stacks hold up to 20 regiments; split and merge them in the army panel. Appoint a general to boost an army.</p>
      <p><b>Conquest costs:</b> conquered provinces are restless. Unrest climbs unless you garrison them (above 60% income halves; at 100% they revolt). Set each province's <i>policy</i> &mdash; taxation, conscription or martial order &mdash; to trade gold, manpower and order. Armies far from friendly soil lose men to supply shortages and tire when marching; <i>forced marches</i> trade men and fatigue for speed. Fortified towns can be starved out or <i>stormed</i> at a cost.</p>
      <p><b>Diplomacy:</b> declare war, propose alliances, and negotiate peace on your terms. Your <i>war score</i> (battles won, provinces taken) decides how much gold or territory the enemy will give up. Allies of a defender may join the war. Britain subsidises its allies with gold. Watch for historical events.</p>
      <p><b>Navy (optional, chosen on the start screen; harder):</b> build a <i>Shipyard</i> in a port, then Ships of the Line and Frigates. Select a fleet (its little ship icon) and pick a destination from the list, or right-click a sea zone ring or a friendly port. There are five seas (Atlantic &amp; North Sea, Western and Eastern Mediterranean, Black Sea, Baltic); neighbouring seas connect through shared ports. Hostile fleets in the same sea fight an automatic battle. A fleet at sea alone <b>blockades</b> enemy ports in that sea (income halved, no shipbuilding) and enemy armies cannot sail through it unless they have a fleet of their own there.</p>
      <p><b>Sound:</b> procedural effects and music &mdash; toggle with the speaker button. The game autosaves every turn (Continue on the start screen).</p>
      <p><b>Battles:</b> when armies meet you may <i>auto-resolve</i> or <i>fight</i> the tactical battle. In battle: select regiments (click / drag-box), right-click to move or attack, right-drag to draw a battle line, F1-F4 for Line/Column/Square/Skirmish, Ctrl+1-9 to save a control group (press the digit to recall it, twice to centre), C to charge, H to halt, R to rally with your general, Space to pause (you can still give orders while paused). Hold the flagged objectives for victory points: hold them all for 75 seconds or lead by 25 VP at the time limit to win. Hover or select a regiment to see its flank arcs (green front, yellow flanks, red rear). Battles start at half speed; use the speed buttons to slow down or speed up. Fire from the front, flank and rear them, keep infantry in square against cavalry, and keep your general close to break-prone units.</p>
      </div><div class="foot"><button class="primary" data-r="x">Got it</button></div>`);
  }
  function relBar(v) {
    const w = Math.abs(v) / 100 * 30;
    return `<span class="relbar"><i style="left:${v >= 0 ? 30 : 30 - w}px;width:${w}px;background:${v >= 0 ? '#5cb85c' : '#d9534f'}"></i></span> ${v > 0 ? '+' : ''}${Math.round(v)}`;
  }
  async function showDiplomacy() {
    const s = S(), me = s.player;
    ui.dipOpened = true;
    const m = $('#modal');
    const close = () => { m.hidden = true; m.innerHTML = ''; refresh(); };
    const main = (msg) => {
      const rows = Object.keys(s.factions).filter((f) => f !== me && s.factions[f].alive).map((f) => {
        const war = C.atWar(me, f), al = C.allied(me, f), rel = C.rel(me, f);
        const ws = war ? C.warScore(me, f) : 0;
        const status = war ? `<span class="tag war">WAR</span> <small class="${ws >= 0 ? 'good' : 'bad'}" title="War score">${ws >= 0 ? '+' : ''}${Math.round(ws)}</small>` : al ? '<span class="tag ally">ALLY</span>' : '<span class="tag peace">PEACE</span>';
        const tr = (k, lbl, tip) => (C.hasTreaty(k, me, f) ? `<button data-d="un-${k}:${f}" class="on" data-tip="${tip} Click to cancel.">${lbl} \u2714</button>` : `<button data-d="${k}:${f}" data-tip="${tip}">${lbl}</button>`);
        const tg = f !== 'minor' ? C.tradeGain(me, f) : 0, tg2 = f !== 'minor' ? C.tradeGain(f, me) : 0;
        const treat = f !== 'minor' && !war ? tr('trade', C.hasTreaty('trade', me, f) ? 'Trade' : `Trade +${tg}/mo`, `<b>Trade agreement</b><br>${C.hasTreaty('trade', me, f) ? `Currently earns you about <b>+${tg} gold per month</b> (they earn about +${tg2}).` : `You would earn about <b>+${tg} gold per month</b>, and the ${esc(F(f).adj)} about +${tg2}. The bonus is about 7% of the partner's provincial income (max 45 a month) and ends if war breaks out. Needs fair relations.`}`) + tr('access', 'Access', '<b>Military access</b><br>Lets armies cross each other\'s land without war (and keeps supply lines open).') + (al ? tr('marriage', 'Marriage', '<b>Royal marriage</b><br>Binds an alliance: harder to break, and the partner is far more likely to join your wars. Needs relations +30.') : '') : '';
        const btns = war ? `<button data-d="peace:${f}">Negotiate peace</button>` : (al ? `<button data-d="break:${f}">Break alliance</button>` : `${f !== 'minor' ? `<button data-d="ally:${f}">Propose alliance</button>` : ''}<button class="danger" data-d="war:${f}">Declare war</button>`) + treat;
        return `<tr><td>${flag(f)}${esc(F(f).name)}</td><td>${status}</td><td>${relBar(rel)}</td><td>${C.provincesOf(f).length}</td><td class="btns">${btns}</td></tr>`;
      }).join('');
      m.innerHTML = `<div class="dlg"><h2>Diplomacy</h2><div class="body"><table class="t"><tr><th>Nation</th><th>Status</th><th>Opinion</th><th>Prov</th><th>Actions</th></tr>${rows}</table><p class="muted" id="dipmsg" style="min-height:20px">${esc(msg || '')}</p></div><div class="foot"><button id="dipclose">Close</button></div></div>`;
      m.hidden = false;
      $('#dipclose').onclick = close;
      m.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => {
        const [act, f] = b.dataset.d.split(':');
        if (act === 'war') warGoal(f);
        else if (act === 'trade' || act === 'access' || act === 'marriage') { const [ok, why] = C.proposeTreaty(act, me, f); refresh(); main(why); }
        else if (act.startsWith('un-')) { C.cancelTreaty(act.slice(3), me, f); refresh(); main('Treaty cancelled.'); }
        else if (act === 'peace') terms(f);
        else if (act === 'ally') { const [ok, why] = C.acceptsAlliance(f, me); if (ok) C.makeAlliance(me, f); refresh(); main(why); }
        else if (act === 'break') { C.breakAlliance(me, f); refresh(); main('Alliance broken.'); }
      }));
    };
    const warGoal = (f) => {
      const cand = C.provincesOf(f).filter((p) => p.adj.some((i) => s.provinces[NAP.world.provs[i].id].owner === me) || p.port).map((p) => ({ p, v: C.provValue ? C.provValue(p.id) : p.income })).sort((x, y) => y.v - x.v).slice(0, 6);
      m.innerHTML = `<div class="dlg"><h2>War against ${esc(F(f).name)}</h2><div class="body"><p>Choose your <b>war goal</b>. Demanding it at the peace table counts in your favour; other demands look illegitimate and are harder to win.</p>
        ${cand.map((c, i) => `<label class="termopt"><input type="radio" name="goal" value="province:${c.p.id}" ${i === 0 ? 'checked' : ''}>Take ${esc(c.p.name)}</label>`).join('')}
        <label class="termopt"><input type="radio" name="goal" value="gold" ${cand.length ? '' : 'checked'}>Win an indemnity (gold)</label>
        <label class="termopt"><input type="radio" name="goal" value="none">No fixed goal</label></div>
        <div class="foot"><button id="wback">Back</button><button class="danger" id="wgo">Declare war</button></div></div>`;
      $('#wback').onclick = () => main('');
      $('#wgo').onclick = () => { const v = m.querySelector('input[name=goal]:checked').value; const goal = v === 'gold' ? { by: me, type: 'gold' } : v === 'none' ? { by: me, type: 'none' } : { by: me, type: 'province', id: v.split(':')[1] }; C.declareWar(me, f, undefined, goal); refresh(); main(`You declare war on ${F(f).name}.`); };
    };
    const termHelp = (id) => id === 'status' ? 'A "white peace": the war simply ends. Nobody pays anything and no province changes hands; everyone keeps what they hold now, and a 12-month truce follows. The safest deal when you cannot win or cannot afford to keep fighting.'
      : id === 'gold' ? 'They pay you gold. No land changes hands.'
      : id === 'tribute' ? 'You pay them gold to end the war. A way of buying peace when you are losing.'
      : id.startsWith('province:') ? 'They hand over this province. It is much easier to win if it was your war goal.'
      : id.startsWith('release:') ? 'You give back a province you captured.' : '';
    const terms = (f) => {
      const opts = C.peaceOptions(me, f), ws = C.warScore(me, f);
      m.innerHTML = `<div class="dlg"><h2>Peace with ${esc(F(f).name)}</h2><div class="body">
        <p>War score: <b class="${ws >= 0 ? 'good' : 'bad'}">${ws >= 0 ? '+' : ''}${Math.round(ws)}</b> <span class="muted">(battles won and provinces taken; the higher, the harsher the terms they may accept)</span></p>
        ${opts.map((o, i) => `<label class="termopt"><input type="radio" name="term" value="${esc(o.id)}" ${i === 0 ? 'checked' : ''}><span>${esc(o.label)}<small class="muted" style="display:block">${esc(termHelp(o.id))}</small></span></label>`).join('')}
        <p class="muted" id="dipmsg" style="min-height:20px"></p></div>
        <div class="foot"><button id="tback">Back</button><button class="primary" id="tgo">Propose</button></div></div>`;
      $('#tback').onclick = () => main('');
      $('#tgo').onclick = () => {
        const id = m.querySelector('input[name=term]:checked').value;
        const [ok, msg] = C.proposePeace(me, f, id);
        refresh();
        if (ok) main(msg); else { $('#dipmsg').textContent = msg; }
      };
    };
    main('');
  }
  async function showOverview() {
    const s = S();
    const rows = Object.keys(s.factions).filter((f) => f !== 'minor').map((f) => ({ f, alive: s.factions[f].alive, n: C.provincesOf(f).length, inc: C.factionIncome(f), arm: C.armiesOf(f).reduce((a, x) => a + x.units.length, 0), ships: C.fleetsOf(f).reduce((a, x) => a + C.shipCount(x), 0), pow: C.factionPower(f), gold: s.factions[f].gold, war: C.warsOf(f).map((x) => F(x).adj).join(', ') }))
      .sort((a, b) => b.n - a.n);
    const html = `<h2>Overview of Europe</h2><div class="body"><table class="t"><tr><th>Nation</th><th>Prov</th><th>Income</th><th>Regts</th>${s.naval ? '<th>Ships</th>' : ''}<th>Army</th><th>Treasury</th><th>At war with</th></tr>
      ${rows.map((r) => `<tr style="${r.alive ? '' : 'opacity:.4'}"><td>${flag(r.f)}${esc(F(r.f).name)}${r.f === s.player ? ' <b>(you)</b>' : ''}</td><td>${r.n}</td><td>${fmt(r.inc)}</td><td>${r.arm}</td>${s.naval ? `<td>${r.ships}</td>` : ''}<td>${fmt(r.pow / 1000)}k</td><td>${fmt(r.gold)}</td><td>${r.alive ? esc(r.war || '—') : 'Eliminated'}</td></tr>`).join('')}</table>
      <p class="muted">Victory: hold 55% of all provinces, or eliminate every rival. Survive until the end of 1815 for a score by territory.</p></div><div class="foot"><button data-r="x">Close</button></div>`;
    await modal(html);
  }

  // ------------------------------------------------------------------ campaign hooks
  C.hooks.notify = (text, kind) => { pushLog(text, kind, S() ? S().turn : 0); };
  function pushLog(text, kind, t) {
    const list = $('#loglist'); if (!list) return;
    const d = document.createElement('div');
    d.className = 'k-' + (kind || 'info'); if ((kind || '').endsWith('-minor')) d.dataset.minor = '1';
    d.innerHTML = `<span class="t">${S() ? NAP.MONTHS[(((t || 0) + 0) % 12)].slice(0, 3) : ''}</span>${esc(text)}`;
    d.hidden = d.dataset.minor && !$('#logminor').checked;
    list.appendChild(d);
    while (list.children.length > 80) list.firstChild.remove();
    list.scrollTop = list.scrollHeight;
  }
  C.hooks.refresh = () => refresh();
  // turn playback: each nation's moves are shown in turn
  C.hooks.phase = async ({ f, moves }) => {
    if (ui.skipPhase || ui.playback === 'off' || $('#game').hidden) return;
    const w = NAP.world, inView = (id) => { const p = w.byId[id], sx = (p.cx - ui.cam.x) * ui.cam.z + vw / 2, sy = (p.cy - ui.cam.y) * ui.cam.z + vh / 2; return sx > 20 && sy > 20 && sx < vw - 20 && sy < vh - 20; };
    const s = S(), relevant = f === s.player || C.atWar(f, s.player) || C.allied(f, s.player);
    const visible = moves.some((m) => inView(m.from) || inView(m.to));
    if (!visible && !relevant) return;
    if (!visible) { const p = w.byId[moves[0].to]; ui.cam.x = p.cx; ui.cam.y = p.cy; clampCam(); }
    ui.moveArrows = moves.map((m) => ({ from: m.from, to: m.to, color: F(f).color }));
    const b = $('#phasebanner'); b.hidden = false; b.style.setProperty('--c', F(f).color);
    b.textContent = `${F(f).name} moves \u2014 ${moves.length} ${moves.length > 1 ? 'armies' : 'army'}`;
    dirty = true;
    await new Promise((r) => setTimeout(r, ui.playback === 'fast' ? 380 : 900));
    ui.moveArrows = null; b.hidden = true; dirty = true;
  };

  C.hooks.askBattle = async (info) => {
    const s = S();
    const side = (arr) => {
      const f = arr[0].owner, men = arr.reduce((a, x) => a + C.armyMen(x), 0), n = arr.reduce((a, x) => a + x.units.length, 0);
      const comp = {}; arr.forEach((a) => a.units.forEach((u) => (comp[u.type] = (comp[u.type] || 0) + 1)));
      const g = arr.map((a) => (a.general ? s.generals[a.general] : null)).filter(Boolean)[0];
      return `<div class="sidebox" style="--c:${F(f).color}"><h3>${esc(F(f).name)}</h3>${fmt(men)} men in ${n} regiments<br>${Object.keys(comp).map((t) => comp[t] + ' ' + U[t].short).join(', ')}<br>${g ? '★ ' + esc(g.name) + ` (${g.atk}/${g.def}/${g.lead})` : '<span class="muted">No general</span>'}</div>`;
    };
    const p = NAP.world.byId[info.prov];
    const html = `<h2>Battle at ${esc(p.name)}</h2><div class="body"><p>${info.playerIsAttacker ? 'Your army attacks!' : 'Your army is attacked!'} Terrain: <b>${{ p: 'Plains', h: 'Hills', f: 'Forest', m: 'Mountains' }[info.terrain]}</b> · Weather: <b>${{ clear: 'Clear', rain: 'Rain (muskets weaker)', fog: 'Fog (short sight)', snow: 'Snow (slow, tiring)' }[info.weather || 'clear']}</b>${info.tod === 'dusk' ? ' · <b>Dusk</b> (battle ends at nightfall)' : info.tod === 'dawn' ? ' · Dawn' : ''}${info.fort ? ` · Fortification level ${info.fort}` : ''}.</p>
      <div class="sides">${side(info.sideA)}${side(info.sideD)}</div></div>
      <div class="foot"><button data-r="auto">Auto-resolve</button><button class="primary" data-r="fight">Fight the battle</button></div>`;
    return modal(html, 'event');
  };
  C.hooks.runBattle = async (spec) => {
    const root = $('#battle');
    $('#game').hidden = true; root.hidden = false;
    const res = await NAP.runBattle(spec, root);
    root.hidden = true; $('#game').hidden = false;
    resize();
    return res;
  };
  C.hooks.event = async (ev, choices) => {
    if (NAP.audio) NAP.audio.sfx('bell');
    const art = NAP.guide.eventArt(ev);
    if (!choices) { await modal(`<h2>${esc(ev.title)}</h2>${art}<div class="body"><p style="font-size:15px">${esc(ev.text)}</p></div><div class="foot"><button class="primary" data-r="ok">Continue</button></div>`, 'event'); return 0; }
    const html = `<h2>${esc(ev.title)}</h2>${art}<div class="body"><p style="font-size:15px">${esc(ev.text)}</p></div><div class="foot" style="flex-direction:column;align-items:stretch">${choices.map((c, i) => `<button data-r="${i}" ${i === 0 ? 'class="primary"' : ''}>${esc(c.label)}</button>`).join('')}</div>`;
    const r = await modal(html, 'event');
    return +r;
  };
  C.hooks.offer = async (m) => {
    const f = F(m.from);
    if (m.type === 'trade-offer') return (await modal(`<h2>Trade proposal</h2><div class="body"><p>The ${esc(f.name)} (${esc(f.leader)}) proposes a trade agreement. You would earn about <b>+${C.tradeGain(S().player, m.from)} gold per month</b> and they about +${C.tradeGain(m.from, S().player)}. The agreement ends if war breaks out between you.</p></div><div class="foot"><button data-r="no">Decline</button><button class="primary" data-r="yes">Sign agreement</button></div>`, 'event')) === 'yes';
    const html = m.type === 'peace-offer'
      ? `<h2>Peace proposal</h2><div class="body"><p>The ${esc(f.name)} (${esc(f.leader)}) offers peace${m.demand ? ` on condition that you pay <b>${m.demand} gold</b>` : ''}. Captured provinces will remain with their current owners.</p></div><div class="foot"><button data-r="no">Refuse</button><button class="primary" data-r="yes">Accept peace</button></div>`
      : `<h2>Alliance proposal</h2><div class="body"><p>The ${esc(f.name)} (${esc(f.leader)}) proposes an alliance against our common enemies.</p></div><div class="foot"><button data-r="no">Decline</button><button class="primary" data-r="yes">Accept alliance</button></div>`;
    return (await modal(html, 'event')) === 'yes';
  };

  // ------------------------------------------------------------------ map interaction
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = canvas.getBoundingClientRect();
    vw = r.width; vh = r.height;
    canvas.width = Math.max(1, vw * dpr); canvas.height = Math.max(1, vh * dpr);
    dirty = true;
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(() => { if (!$('#game').hidden) resize(); }).observe($('#mapwrap'));

  function toWorld(sx, sy) { return { x: (sx - vw / 2) / ui.cam.z + ui.cam.x, y: (sy - vh / 2) / ui.cam.z + ui.cam.y }; }
  function evPos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function markerAt(w) {
    const ms = ui.opts.markers || [];
    for (let i = ms.length - 1; i >= 0; i--) { const m = ms[i]; if (Math.abs(w.x - m.x) <= m.w / 2 + 6 && Math.abs(w.y - m.y) <= m.h / 2 + 6) return m; }
    return null;
  }
  let drag = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    const p = evPos(e);
    if (e.button === 0 || e.button === 1) { drag = { sx: p.x, sy: p.y, cx: ui.cam.x, cy: ui.cam.y, moved: false, btn: e.button }; }
  });
  window.addEventListener('mousemove', (e) => {
    if (!$('#game') || $('#game').hidden) return;
    const p = evPos(e);
    if (drag) {
      const dx = p.x - drag.sx, dy = p.y - drag.sy;
      if (drag.moved || Math.abs(dx) + Math.abs(dy) > 9) { drag.moved = true; canvas.classList.add('drag'); }
      if (drag.moved) { ui.cam.x = drag.cx - dx / ui.cam.z; ui.cam.y = drag.cy - dy / ui.cam.z; clampCam(); dirty = true; }
    }
    if (e.target === canvas && !drag) {
      const w = toWorld(p.x, p.y), pr = NAP.world.provAt(w.x, w.y);
      const id = pr ? pr.id : null;
      if (id !== ui.hover) { ui.hover = id; dirty = true; }
      const tip = $('#tip');
      if (pr && S()) { tip.hidden = false; tip.innerHTML = provTip(pr); tip.style.left = p.x + 14 + 'px'; tip.style.top = p.y + 14 + 'px'; }
      else tip.hidden = true;
      // preview path for selected army
      const a = selArmy();
      if (a && a.owner === S().player && pr && pr.id !== a.prov) {
        if (ui.previewTo !== pr.id) { ui.previewTo = pr.id; ui.preview = C.findPath(a.owner, a.prov, pr.id); dirty = true; }
      } else if (ui.preview) { ui.preview = null; ui.previewTo = null; dirty = true; }
    }
  });
  canvas.addEventListener('mouseleave', () => { $('#tip').hidden = true; ui.hover = null; dirty = true; });
  window.addEventListener('mouseup', (e) => {
    if (!drag) return;
    const d = drag; drag = null; canvas.classList.remove('drag');
    if (d.moved || d.btn !== 0 || !S()) return;
    const p = evPos(e), w = toWorld(p.x, p.y);
    const m = markerAt(w);
    if (m && m.kind === 'fleet') { const fl = S().fleets.find((x) => x.id === m.id); ui.sel = { prov: fl.port || null, army: null, fleet: fl.id }; refresh(); return; }
    if (m) { const a = S().armies.find((x) => x.id === m.id); ui.sel = { prov: a.prov, army: m.id, fleet: null }; refresh(); return; }
    const pr = NAP.world.provAt(w.x, w.y);
    ui.sel.fleet = null; ui.sel.army = null; ui.sel.prov = pr ? pr.id : null;
    // keep army selected if clicking within its own province? no, deselect
    refresh();
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 2 || !S()) return;
    const fl = selFleet();
    if (fl && fl.owner === S().player) {
      const w0 = toWorld(evPos(e).x, evPos(e).y); let target = null;
      (NAP.SEA_ZONES || []).forEach((z, i) => { const [zx, zy] = NAP.zonePos(i); if (Math.hypot(zx - w0.x, zy - w0.y) < 40) target = 'z:' + i; });
      const pr0 = target ? null : NAP.world.provAt(w0.x, w0.y);
      if (pr0 && pr0.port) target = 'p:' + pr0.id;
      if (!target) { toast('Right-click a sea zone ring or one of your ports'); return; }
      if (target === (fl.port ? 'p:' + fl.port : 'z:' + fl.zone)) { fl.path = []; refresh(); return; }
      if (C.orderFleet(fl, target)) toast(`Sailing: ${fl.path.length} turn${fl.path.length > 1 ? 's' : ''}`); else toast('No route there (you can only dock at your own or allied ports)');
      refresh(); return;
    }
    const a = selArmy();
    if (!a || a.owner !== S().player) return;
    const w = toWorld(evPos(e).x, evPos(e).y), pr = NAP.world.provAt(w.x, w.y);
    if (!pr) return;
    if (pr.id === a.prov) { a.path = []; refresh(); return; }
    if (C.orderMove(a, pr.id)) { toast(`Marching to ${pr.name} (${a.path.length} turn${a.path.length > 1 ? 's' : ''})`); }
    else toast(C.lastError || 'No route there (diplomatic or sea restrictions)');
    refresh();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // normalise wheels (notches, lines, trackpad pixels) and ease toward the target zoom, keeping the point under the cursor fixed
    const dy = Math.max(-240, Math.min(240, e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1)));
    const p = evPos(e), w0 = toWorld(p.x, p.y);
    ui.zt = Math.max(0.45, Math.min(4, (ui.zt || ui.cam.z) * Math.exp(-dy * 0.0011)));
    ui.zAnchor = { px: p.x, py: p.y, wx: w0.x, wy: w0.y }; dirty = true;
  }, { passive: false });
  function clampCam() { ui.cam.x = Math.max(0, Math.min(NAP.MAP.W, ui.cam.x)); ui.cam.y = Math.max(0, Math.min(NAP.MAP.H, ui.cam.y)); }
  function toggleSide() { const hid = $('#side').classList.toggle('hide'); $('#sidetoggle').innerHTML = hid ? '&#9666; Details' : 'Details &#9656;'; }
  $('#sidetoggle').onclick = toggleSide;
  function selFleet() { const s = S(); return s && ui.sel.fleet ? (s.fleets || []).find((x) => x.id === ui.sel.fleet) : null; }
  function selArmy() { const s = S(); return s && ui.sel.army ? s.armies.find((a) => a.id === ui.sel.army) : null; }

  window.addEventListener('keydown', (e) => {
    if ($('#game').hidden || !$('#battle').hidden || !$('#modal').hidden) return;
    if (/input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'Enter') { endTurn(); e.preventDefault(); }
    else if (e.key === 'Tab') { toggleSide(); e.preventDefault(); }
    else if (e.key === 'Escape') { ui.sel = { prov: null, army: null }; refresh(); }
    else if (e.key === 'd' || e.key === 'D') showDiplomacy();
    const step = 40 / ui.cam.z;
    if (e.key === 'ArrowLeft') ui.cam.x -= step; if (e.key === 'ArrowRight') ui.cam.x += step;
    if (e.key === 'ArrowUp') ui.cam.y -= step; if (e.key === 'ArrowDown') ui.cam.y += step;
    clampCam(); dirty = true;
  });
  $('#logtoggle').onclick = () => { $('#log').classList.toggle('min'); $('#logtoggle').textContent = $('#log').classList.contains('min') ? '+' : '−'; };
  $('#logminor').onchange = (e) => { $('#loglist').querySelectorAll('[data-minor]').forEach((d) => (d.hidden = !e.target.checked)); };

  // ------------------------------------------------------------------ tutorial & practice battle
  function startTutorial() {
    ui.difficulty = 'easy'; ui.picked = 'france';
    beginGame('france', true);
    ui.tut = { on: true, step: 0 };
    ui.sel = { prov: null, army: null };
    refresh();
  }
  function tutStep() { return ui.tut && ui.tut.on ? NAP.guide.STEPS[ui.tut.step] : null; }
  function tutEnd() { ui.tut = { on: false, step: 0 }; const c = $('#coach'); if (c) c.remove(); ui.pulseProv = null; applyHighlights(); dirty = true; }
  function tutAdvance() {
    ui.tut.step++;
    if (ui.tut.step >= NAP.guide.STEPS.length) { tutEnd(); toast('Tutorial complete — good luck!'); return; }
    tutRender();
  }
  function tutCheck() {
    const st = tutStep(); if (!st || !st.check) return;
    let ok = false; try { ok = st.check({ S: S(), ui }); } catch (e) { ok = false; }
    if (ok) tutAdvance();
  }
  function tutRender() {
    const old = $('#coach'); if (old) old.remove();
    const st = tutStep();
    if (!st) { ui.pulseProv = null; applyHighlights(); return; }
    const total = NAP.guide.STEPS.length, i = ui.tut.step;
    const el = document.createElement('div'); el.id = 'coach';
    el.innerHTML = `<h3>${esc(st.title)}</h3><div class="ct">${st.text}</div>
      <div class="cf"><div class="dots">${NAP.guide.STEPS.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'on' : ''}"></i>`).join('')}</div>
      ${st.manual ? '' : '<span class="hintdo">Do this to continue</span>'}
      ${st.practice ? '<button id="tpractice">Practice battle</button>' : ''}
      <button id="tskip">Skip tutorial</button>
      ${st.manual ? `<button class="primary" id="tnext">${st.last ? 'Finish' : 'Next'}</button>` : '<button id="tstep">Skip step</button>'}</div>`;
    $('#mapwrap').appendChild(el);
    $('#tskip').onclick = tutEnd;
    if ($('#tnext')) $('#tnext').onclick = tutAdvance;
    if ($('#tstep')) $('#tstep').onclick = tutAdvance;
    if ($('#tpractice')) $('#tpractice').onclick = startPractice;
    ui.pulseProv = st.pulse ? st.pulse(S()) : null;
    applyHighlights(); dirty = true;
    tutCheck();
  }
  function applyHighlights() {
    document.querySelectorAll('.tut-hl').forEach((e) => e.classList.remove('tut-hl'));
    const st = tutStep(); if (!st || !st.hl) return;
    st.hl.forEach((sel) => document.querySelectorAll(sel).forEach((e) => e.classList.add('tut-hl')));
  }
  async function startPractice() {
    const wasGame = !$('#game').hidden;
    $('#start').hidden = true; $('#game').hidden = true;
    const root = $('#battle'); root.hidden = false;
    await NAP.runBattle(NAP.guide.practiceSpec(), root);
    root.hidden = true;
    if (wasGame) { $('#game').hidden = false; resize(); dirty = true; } else showStart();
  }

  // ------------------------------------------------------------------ minimap
  const mm = $('#minimap'), mmx = mm.getContext('2d');
  function drawMinimap() {
    const k = mm.width / NAP.MAP.W;
    mmx.setTransform(1, 0, 0, 1, 0, 0);
    mmx.fillStyle = '#7fa6b8'; mmx.fillRect(0, 0, mm.width, mm.height);
    mmx.imageSmoothingEnabled = true;
    mmx.drawImage(NAP.world.colorCanvas, 0, 0, NAP.MAP.W * k, NAP.MAP.H * k);
    const s = S();
    for (const a of s.armies) {
      const p = NAP.world.byId[a.prov];
      mmx.fillStyle = F(a.owner).color; mmx.strokeStyle = '#000'; mmx.lineWidth = 1;
      mmx.fillRect(p.cx * k - 2, p.cy * k - 2, 4, 4); mmx.strokeRect(p.cx * k - 2, p.cy * k - 2, 4, 4);
    }
    const w = vw / ui.cam.z * k, h = vh / ui.cam.z * k;
    mmx.strokeStyle = '#fff'; mmx.lineWidth = 1.5;
    mmx.strokeRect(ui.cam.x * k - w / 2, ui.cam.y * k - h / 2, w, h);
  }
  let mmDrag = false;
  const mmMove = (e) => {
    const r = mm.getBoundingClientRect(), k = NAP.MAP.W / r.width;
    ui.cam.x = (e.clientX - r.left) * k; ui.cam.y = (e.clientY - r.top) * k; clampCam(); dirty = true;
  };
  mm.addEventListener('mousedown', (e) => { mmDrag = true; mmMove(e); e.stopPropagation(); });
  window.addEventListener('mousemove', (e) => { if (mmDrag) mmMove(e); });
  window.addEventListener('mouseup', () => { mmDrag = false; });

  // ------------------------------------------------------------------ render loop
  function refresh() { if (!S()) return; renderTop(); renderSide(); dirty = true; if (ui.tut && ui.tut.on) { tutCheck(); if (ui.tut.on && !$('#coach')) tutRender(); else applyHighlights(); } }
  function frame() {
    requestAnimationFrame(frame);
    if (ui.pulseProv && !$('#game').hidden) dirty = true;
    if (ui.zt && Math.abs(ui.zt - ui.cam.z) > 0.002) {
      ui.cam.z += (ui.zt - ui.cam.z) * 0.3;
      if (ui.zAnchor) { const a = ui.zAnchor, w1 = toWorld(a.px, a.py); ui.cam.x += a.wx - w1.x; ui.cam.y += a.wy - w1.y; clampCam(); }
      dirty = true;
    } else if (ui.zt) { ui.zt = ui.cam.z; }
    if (!dirty || $('#game').hidden || !S()) return;
    dirty = false;
    const s = S(), a = selArmy();
    const opts = ui.opts;
    opts.selProv = ui.sel.prov; opts.hoverProv = ui.hover;
    opts.selFleet = selFleet() || null; opts.moveArrows = ui.moveArrows || null;
    opts.selArmy = ui.sel.army; opts.pulse = ui.pulseProv || null;
    opts.targets = a && a.owner === s.player ? C.neighbors(a.owner, a.prov) : [];
    opts.seaFrom = a && a.owner === s.player && NAP.world.byId[a.prov].port ? a.prov : null;
    opts.supplyPaths = C.armiesOf(s.player).filter((x) => x === a || (x.supply || 0) >= 2).map((x) => C.supplyPath(x)).filter((q) => q.length > 1);
    opts.pathProvs = a ? [a.prov, ...(a.path.length ? a.path : ui.preview || [])] : null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    NAP.drawMap(ctx, ui.cam, vw, vh, s, opts);
    drawMinimap();
  }

  // ------------------------------------------------------------------ tooltips (data-tip, and any title attribute)
  const tt = document.createElement('div'); tt.id = 'tt'; tt.hidden = true; $('#app').appendChild(tt);
  const posTip = (e) => {
    const pad = 14, w = tt.offsetWidth, h = tt.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth - 8) x = e.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = e.clientY - h - pad;
    tt.style.left = Math.max(6, x) + 'px'; tt.style.top = Math.max(6, y) + 'px';
  };
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest('[data-tip],[title]');
    if (!el) { tt.hidden = true; return; }
    if (el.hasAttribute('title')) { if (!el.dataset.tip) el.dataset.tip = el.getAttribute('title').replace(/&/g, '&amp;').replace(/</g, '&lt;'); el.removeAttribute('title'); }
    tt.innerHTML = el.dataset.tip; tt.hidden = false; posTip(e);
  });
  document.addEventListener('mousemove', (e) => { if (!tt.hidden) posTip(e); });
  document.addEventListener('mouseleave', () => { tt.hidden = true; });
  document.addEventListener('mousedown', () => { tt.hidden = true; });

  // ------------------------------------------------------------------ boot
  NAP.buildWorld();
  if (NAP.audio) NAP.audio.music('map');
  window.NAP_UI_READY = true;
  showStart();
  requestAnimationFrame(frame);
  NAP.ui.refresh = refresh;
  NAP.ui.endTurn = endTurn;
})();
