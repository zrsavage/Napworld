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
  function showStart() {
    if (ui.tut && ui.tut.on) tutEnd();
    $('#game').hidden = true; $('#battle').hidden = true;
    const has = !!lsGet(SAVE_KEY), hasAuto = !!lsGet(AUTOSAVE_KEY);
    let html = `<h1>NAPWORLD</h1><div class="sub">Europe, 1805 &mdash; the Emperor's ambition, the old order's last stand</div>
      <div class="opts"><label>Difficulty <select id="diff"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option></select></label>
      ${hasAuto ? '<button id="autobtn">Continue (autosave)</button>' : ''}${has ? '<button id="loadbtn">Load saved campaign</button>' : ''}<button id="tutbtn" class="primary">&#9654; Tutorial campaign</button><button id="practbtn">Practice battle</button><button id="helpbtn">How to play</button></div>
      <div class="guidebox"><b>Which nation should I pick?</b> New to the game? Start with <b>Russia</b>: it is huge, far from the early fighting, and nobody can reach you for months, so you can learn at your own pace. <b>Britain</b> is a relaxed second choice (rich, safe on an island, few battles at first). Each card shows a difficulty rating from <span class="tier tier-beginner">Beginner</span> to <span class="tier tier-expert">Expert</span> and a one-line reason. Hover a card for tips. The tutorial campaign teaches the controls using France, which is a <i>hard</i> nation to win with.</div>
      <div class="cards">`;
    const order = Object.keys(NAP.NATION_GUIDE).sort((x, y) => NAP.NATION_GUIDE[x].rank - NAP.NATION_GUIDE[y].rank);
    for (const id of order) {
      const f = F(id), st = startFactionStats(id), g = NAP.NATION_GUIDE[id];
      const tips = '<b>' + esc(f.name) + '</b><br>' + g.tips.map((t) => '\u2022 ' + esc(t)).join('<br>');
      html += `<div class="card${id === ui.picked ? ' sel' : ''}" data-f="${id}" style="--c:${f.color}" data-tip="${esc(tips)}">${g.ribbon ? `<span class="ribbon">${esc(g.ribbon)}</span>` : ''}
        <h3>${esc(f.name)}</h3><div class="leader">${esc(f.leader)}</div>
        <div><span class="tier tier-${g.tier.toLowerCase()}">${g.tier}</span>${g.war ? '<span class="tag war" style="margin-left:6px">starts at war</span>' : '<span class="tag peace" style="margin-left:6px">starts at peace</span>'}</div>
        <p>${esc(f.desc)}</p><p class="why"><b>Why ${g.tier.toLowerCase()}:</b> ${esc(g.why)}</p>
        <div class="stats"><span>${st.n} provinces</span><span>${st.units} regiments</span></div></div>`;
    }
    html += `</div><div id="startbar"><button class="primary" id="beginbtn" style="font-size:18px;padding:10px 40px">Begin the Campaign</button></div>`;
    $('#start').innerHTML = html; $('#start').hidden = false;
    $('#diff').value = ui.difficulty;
    $('#diff').onchange = (e) => (ui.difficulty = e.target.value);
    $('#start').querySelectorAll('.card').forEach((c) => (c.onclick = () => { ui.picked = c.dataset.f; $('#start').querySelectorAll('.card').forEach((x) => x.classList.toggle('sel', x === c)); }));
    $('#beginbtn').onclick = () => beginGame(ui.picked);
    $('#helpbtn').onclick = showHelp;
    $('#tutbtn').onclick = startTutorial;
    $('#practbtn').onclick = startPractice;
    if (has) $('#loadbtn').onclick = () => loadGame(SAVE_KEY);
    if (hasAuto) $('#autobtn').onclick = () => loadGame(AUTOSAVE_KEY);
    if (!ui.seenIntro && !lsGet('napworld-seen')) {
      ui.seenIntro = true;
      try { localStorage.setItem('napworld-seen', '1'); } catch (e) {}
      modal(`<h2>Welcome to Napworld</h2>${NAP.guide.eventArt({ art: 'flags' })}<div class="body"><p style="font-size:15px">Europe, 1805. Napoleon stands at the head of France, Britain funds coalition after coalition, and the old crowns of Austria, Russia and Prussia prepare to fight. Take any of twelve nations through the Napoleonic Wars with a turn-based campaign map and real-time battles.</p><p>New here? The short guided tutorial teaches the controls in a few minutes.</p></div><div class="foot"><button data-r="no">I'll figure it out</button><button class="primary" data-r="yes">Start the tutorial</button></div>`, 'event').then((r) => { if (r === 'yes') startTutorial(); });
    }
  }

  function beginGame(f) {
    ui.tut = { on: false, step: 0 }; ui.dipOpened = false;
    if (NAP.audio) { NAP.audio.init(); NAP.audio.music('map'); }
    C.newGame(f, ui.difficulty);
    enterGame();
    const cap = NAP.world.byId[S().factions[f].cap];
    ui.cam = { x: cap.cx, y: cap.cy, z: 1.15 };
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
    try { C.deserialize(lsGet(key || SAVE_KEY)); enterGame(); const f = S().player; const cap = NAP.world.byId[S().factions[f].cap]; ui.cam = { x: cap.cx, y: cap.cy, z: 1.1 }; ui.sel = { prov: null, army: null }; refresh(); toast('Game loaded'); }
    catch (e) { console.error(e); toast('Save is corrupted'); }
  }

  // ------------------------------------------------------------------ top bar
  function renderTop() {
    const s = S(), p = s.player, fs = s.factions[p];
    const inc = C.factionIncome(p), up = C.factionUpkeep(p), net = inc - up;
    const provs = C.provincesOf(p).length, total = NAP.world.provs.length;
    const at = C.warsOf(p).filter((x) => x !== 'minor' || true).map((x) => F(x).adj);
    $('#topbar').innerHTML = `
      <span class="flag" style="background:${F(p).color}"></span><span class="fname">${esc(F(p).name)}</span>
      <span class="stat" title="Treasury / net per turn (income ${fmt(inc)} - upkeep ${fmt(up)})">&#128176; <b>${fmt(fs.gold)}</b> <small class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${fmt(net)}</small> <small>(${fmt(inc)} − ${fmt(up)})</small></span>
      <span class="stat" title="Manpower pool / monthly growth">&#128100; <b>${fmt(fs.manpower)}</b> <small>+${fmt(C.manpowerGain(p))}</small></span>
      <span class="stat" title="Provinces held; win at 55%">&#9873; <b>${provs}</b><small>/${total}</small></span>
      <span class="stat" title="Armies">&#9876; <b>${C.armiesOf(p).reduce((a, x) => a + x.units.length, 0)}</b> <small>regts</small></span>
      <span class="stat" title="At war with">${at.length ? `<span class="bad" title="${esc(at.join(', '))}">War${at.length <= 2 ? ': ' + at.join(', ') : ' × ' + at.length}</span>` : '<span class="good">At peace</span>'}</span>
      <span class="spacer"></span>
      <button id="b-dip">Diplomacy</button><button id="b-ov">Overview</button><button id="b-snd" data-nosound="1" title="Sound on/off">${NAP.audio && NAP.audio.muted ? '&#128263;' : '&#128266;'}</button><button id="b-help" title="How to play">?</button><button id="b-save">Save</button><button id="b-menu">Menu</button>
      <span class="date">${C.dateStr()}</span>
      <button class="primary" id="endturn" ${s.busy || s.winner ? 'disabled' : ''}>End Turn <kbd>Enter</kbd></button>`;
    $('#b-snd').onclick = () => { NAP.audio.init(); NAP.audio.setMuted(!NAP.audio.muted); renderTop(); };
    $('#b-help').onclick = showHelp; $('#b-dip').onclick = showDiplomacy; $('#b-ov').onclick = showOverview; $('#b-save').onclick = saveGame;
    $('#b-menu').onclick = async () => { if (await modal(`<h2>Menu</h2><div class="body">Return to the main menu? Unsaved progress will be lost.</div><div class="foot"><button data-r="no">Cancel</button><button class="danger" data-r="yes">Quit to menu</button></div>`) === 'yes') showStart(); };
    $('#endturn').onclick = endTurn;
  }

  async function endTurn() {
    const s = S();
    if (s.busy || s.winner) return;
    // warn about idle armies? keep simple
    $('#endturn').disabled = true; $('#endturn').textContent = 'Processing…';
    ui.sel.army = ui.sel.army && s.armies.find((a) => a.id === ui.sel.army) ? ui.sel.army : null;
    if (NAP.audio) NAP.audio.sfx('roll');
    try { await C.endTurn(); } catch (e) { console.error(e); toast('Error: ' + e.message); s.busy = false; }
    try { localStorage.setItem(AUTOSAVE_KEY, C.serialize()); } catch (e) { /* storage full or blocked */ }
    refresh();
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
    const ps = S().provinces[p.id];
    return `${esc(p.name)} — ${esc(F(ps.owner).adj)}`;
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
    const pid = army ? army.prov : ui.sel.prov;
    if (!pid) { el.innerHTML = `<div class="sec"><h4>Europe, ${C.dateStr()}</h4><p class="muted">Click a province or an army to see details. Right-click a destination to move the selected army.</p>${standings()}</div>`; return; }
    const p = NAP.world.byId[pid], ps = s.provinces[pid], owner = ps.owner, mine = owner === s.player;
    const armies = s.armies.filter((a) => a.prov === pid);
    let html = `<div class="ph" style="--c:${F(owner).color}"><h2>${p.capital ? '★ ' : ''}${esc(p.name)}</h2><div class="own">${esc(F(owner).name)} · ${{ p: 'Plains', h: 'Hills', f: 'Forest', m: 'Mountains' }[p.terrain]}${p.port ? ' · Port' : ''}</div></div>`;
    if (army) html += armyPanel(army);
    html += `<div class="sec"><h4>Province</h4>
      <div class="kv"><span>Income</span><b>${fmt(C.provIncome(ps))}/turn</b></div>
      <div class="kv"><span>Manpower</span><b>+${fmt(p.manpower * 25 * (1 + 0.5 * ps.barracks))}/turn</b></div>
      <div class="kv"><span>Fortification</span><b>${ps.fort ? '♖'.repeat(ps.fort) : 'None'}</b></div>
      <div class="kv"><span>Buildings</span><b style="text-align:right">${Object.keys(NAP.BUILDINGS).filter((b) => b !== 'fort' && ps[b]).map((b) => NAP.BUILDINGS[b].name).join(', ') || '—'}</b></div>
      <div class="kv"><span>Unrest</span><b class="${(ps.unrest || 0) >= 60 ? 'bad' : (ps.unrest || 0) >= 30 ? 'warn' : ''}">${Math.round(ps.unrest || 0)}%</b></div><div class="bar"><i style="width:${Math.round(ps.unrest || 0)}%"></i></div>
      ${!mine && C.atWar(s.player, owner) ? `<div class="kv"><span>Garrison</span><b>~${fmt(C.garrisonStrength(pid))} men</b></div>` : ''}
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
      html += `<div class="sec"><h4>Recruit <span class="qm" data-tip="Raise regiments here. Standard troops are always available; elite troops need a building in this province. Hover a unit for its role and stats.">?</span></h4>`;
      html += Object.keys(U).filter((t) => !U[t].needs).map(unitRow).join('');
      html += `<div class="subh">Elite troops (need buildings)</div>` + Object.keys(U).filter((t) => U[t].needs).map(unitRow).join('');
      if (ps.queue.length) html += `<div class="queue">In training: ${ps.queue.map((q) => U[q.type].short + ' (' + q.left + ')').join(', ')}</div>`;
      html += `</div><div class="sec"><h4>Construction <span class="qm" data-tip="Buildings are permanent upgrades to this province. Hover each one to see what it does and which troops it unlocks.">?</span></h4>`;
      for (const b of Object.keys(NAP.BUILDINGS)) {
        const bd = NAP.BUILDINGS[b], built = b === 'fort' ? ps.fort >= bd.max : ps[b] >= 1, err = C.buildCheck(pid, b);
        html += `<button class="ubtn${err ? ' locked' : ''}" data-bld="${b}" data-tip="${esc(buildingTip(b, ps, err))}"><span>${built && b !== 'fort' ? '\u2714 ' : ''}${bd.name}${b === 'fort' ? ' ' + ps.fort + '/' + bd.max : ''}</span><span>${built && b !== 'fort' ? 'built' : bd.cost + 'g \u00B7 ' + bd.time + 't'}</span></button>`;
      }
      if (ps.build) html += `<div class="queue">Building ${NAP.BUILDINGS[ps.build.type].name} (${ps.build.left} turns)</div>`;
      html += `</div>`;
    } else if (owner !== 'minor' || true) {
      const war = C.atWar(s.player, owner);
      html += `<div class="sec"><h4>Diplomacy</h4><div class="kv"><span>Relations</span><b>${C.rel(s.player, owner) > 0 ? '+' : ''}${Math.round(C.rel(s.player, owner))}</b></div>
        <div class="row">${war ? '<span class="bad">At war</span>' : C.allied(s.player, owner) ? '<span class="good">Allied</span>' : `<button data-war="${owner}" class="danger">Declare war on ${esc(F(owner).adj)}</button>`}</div></div>`;
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-army]').forEach((e) => (e.onclick = () => { ui.sel.army = +e.dataset.army; refresh(); }));
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

  function armyPanel(a) {
    const s = S(), mine = a.owner === s.player, g = a.general ? s.generals[a.general] : null;
    let html = `<div class="sec"><h4>${esc(F(a.owner).adj)} army · ${a.units.length}/${C.stackLimit} regiments</h4>`;
    if (g) html += `<div class="gen"><b>★ ${esc(g.name)}</b> <span class="muted">Lv${g.lvl}</span><br>ATK ${g.atk} · DEF ${g.def} · LEAD ${g.lead} <span class="muted">— ${esc(g.trait)}</span></div>`;
    else html += `<div class="gen muted">No general appointed</div>`;
    html += `<div class="kv"><span>Strength</span><b>${fmt(C.armyMen(a))} men</b></div>`;
    const dpt = C.supplyDepth(a);
    html += `<div class="kv"><span>Fatigue</span><b class="${(a.fatigue || 0) > 50 ? 'bad' : (a.fatigue || 0) > 20 ? 'warn' : ''}">${Math.round(a.fatigue || 0)}%</b></div><div class="kv"><span>Supply</span><b class="${dpt >= 2 ? 'bad' : dpt === 1 ? 'warn' : 'good'}">${dpt === 0 ? 'At home' : dpt === 1 ? 'Foraging' : dpt === 2 ? 'Strained' : 'Cut off'}</b></div>`;
    if (a.path.length) html += `<div class="kv"><span>Destination</span><b>${esc(NAP.world.byId[a.path[a.path.length - 1]].name)} (${a.path.length})</b></div>`;
    html += `<div style="margin-top:6px">`;
    a.units.forEach((u, i) => {
      html += `<div class="unit"><input type="checkbox" data-u="${i}" ${mine ? '' : 'disabled'}><span>${U[u.type].name}${C.vetOf(u) ? ' <span class="gold">' + '\u2605'.repeat(C.vetOf(u)) + '</span>' : ''}</span><span style="text-align:right">${u.men}/${u.max}</span><div class="bar"><i style="width:${Math.round(u.men / u.max * 100)}%"></i></div></div>`;
    });
    html += `</div>`;
    if (mine) {
      const sErr = C.assaultCheck(a);
      html += `<div class="row"><label><input type="checkbox" data-act="forced" ${a.forced ? 'checked' : ''}> Forced march <span class="muted">(2 provinces/turn, −3% men, +fatigue)</span></label></div>`;
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
      if (act === 'split') { const idx = checked(); if (!idx.length || idx.length >= a.units.length) return toast('Select some (not all) regiments'); const na = C.splitArmy(a, idx); if (na) ui.sel.army = na.id; }
      else if (act === 'merge') { const others = S().armies.filter((x) => x !== a && x.prov === a.prov && x.owner === a.owner); let n = 0; others.forEach((o) => { if (C.mergeArmies(a, o)) n++; }); toast(n ? `Merged ${n} army` : 'Nothing to merge (stack limit?)'); }
      else if (act === 'stop') a.path = [];
      else if (act === 'forced') { a.forced = b.checked; }
      else if (act === 'storm') { const r = C.assault(a); toast(r.text); }
      else if (act === 'disband') { const idx = checked(); if (!idx.length) return toast('Tick regiments to disband'); idx.sort((x, y) => y - x).forEach((i) => C.disbandUnit(a, i)); if (!S().armies.includes(a)) ui.sel.army = null; }
      else if (act === 'relieve') { const gid = a.general; if (gid) { S().generals[gid].assigned = null; S().pool[S().generals[gid].owner].push(gid); a.general = null; } }
      refresh();
    }));
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
      <p><b>Sound:</b> procedural effects and music &mdash; toggle with the speaker button. The game autosaves every turn (Continue on the start screen).</p>
      <p><b>Battles:</b> when armies meet you may <i>auto-resolve</i> or <i>fight</i> the tactical battle. In battle: select regiments (click / drag-box), right-click to move or attack, right-drag to draw a battle line, keys 1-4 for Line/Column/Square/Skirmish, C to charge, H to halt, R to rally with your general, Space to pause. Battles start at half speed; use the speed buttons to slow down or speed up. Fire from the front, flank and rear them, keep infantry in square against cavalry, and keep your general close to break-prone units.</p>
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
        const btns = war ? `<button data-d="peace:${f}">Negotiate peace</button>` : al ? `<button data-d="break:${f}">Break alliance</button>` : `${f !== 'minor' ? `<button data-d="ally:${f}">Propose alliance</button>` : ''}<button class="danger" data-d="war:${f}">Declare war</button>`;
        return `<tr><td>${flag(f)}${esc(F(f).name)}</td><td>${status}</td><td>${relBar(rel)}</td><td>${C.provincesOf(f).length}</td><td class="btns">${btns}</td></tr>`;
      }).join('');
      m.innerHTML = `<div class="dlg"><h2>Diplomacy</h2><div class="body"><table class="t"><tr><th>Nation</th><th>Status</th><th>Opinion</th><th>Prov</th><th>Actions</th></tr>${rows}</table><p class="muted" id="dipmsg" style="min-height:20px">${esc(msg || '')}</p></div><div class="foot"><button id="dipclose">Close</button></div></div>`;
      m.hidden = false;
      $('#dipclose').onclick = close;
      m.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => {
        const [act, f] = b.dataset.d.split(':');
        if (act === 'war') { C.declareWar(me, f); refresh(); main(`You declare war on ${F(f).name}.`); }
        else if (act === 'peace') terms(f);
        else if (act === 'ally') { const [ok, why] = C.acceptsAlliance(f, me); if (ok) C.makeAlliance(me, f); refresh(); main(why); }
        else if (act === 'break') { C.breakAlliance(me, f); refresh(); main('Alliance broken.'); }
      }));
    };
    const terms = (f) => {
      const opts = C.peaceOptions(me, f), ws = C.warScore(me, f);
      m.innerHTML = `<div class="dlg"><h2>Peace with ${esc(F(f).name)}</h2><div class="body">
        <p>War score: <b class="${ws >= 0 ? 'good' : 'bad'}">${ws >= 0 ? '+' : ''}${Math.round(ws)}</b> <span class="muted">(battles won and provinces taken; the higher, the harsher the terms they may accept)</span></p>
        ${opts.map((o, i) => `<label class="termopt"><input type="radio" name="term" value="${esc(o.id)}" ${i === 0 ? 'checked' : ''}>${esc(o.label)}</label>`).join('')}
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
    const rows = Object.keys(s.factions).filter((f) => f !== 'minor').map((f) => ({ f, alive: s.factions[f].alive, n: C.provincesOf(f).length, inc: C.factionIncome(f), arm: C.armiesOf(f).reduce((a, x) => a + x.units.length, 0), pow: C.factionPower(f), gold: s.factions[f].gold, war: C.warsOf(f).map((x) => F(x).adj).join(', ') }))
      .sort((a, b) => b.n - a.n);
    const html = `<h2>Overview of Europe</h2><div class="body"><table class="t"><tr><th>Nation</th><th>Prov</th><th>Income</th><th>Regts</th><th>Army</th><th>Treasury</th><th>At war with</th></tr>
      ${rows.map((r) => `<tr style="${r.alive ? '' : 'opacity:.4'}"><td>${flag(r.f)}${esc(F(r.f).name)}${r.f === s.player ? ' <b>(you)</b>' : ''}</td><td>${r.n}</td><td>${fmt(r.inc)}</td><td>${r.arm}</td><td>${fmt(r.pow / 1000)}k</td><td>${fmt(r.gold)}</td><td>${r.alive ? esc(r.war || '—') : 'Eliminated'}</td></tr>`).join('')}</table>
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
    for (let i = ms.length - 1; i >= 0; i--) { const m = ms[i]; if (Math.abs(w.x - m.x) <= m.w / 2 + 2 && Math.abs(w.y - m.y) <= m.h / 2 + 2) return m; }
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
      if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; canvas.classList.add('drag'); }
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
    if (m) { const a = S().armies.find((x) => x.id === m.id); ui.sel.army = m.id; ui.sel.prov = a.prov; refresh(); return; }
    const pr = NAP.world.provAt(w.x, w.y);
    ui.sel.army = null; ui.sel.prov = pr ? pr.id : null;
    // keep army selected if clicking within its own province? no, deselect
    refresh();
  });
  canvas.addEventListener('mouseup', (e) => {
    if (e.button !== 2 || !S()) return;
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
    const p = evPos(e), before = toWorld(p.x, p.y);
    ui.cam.z = Math.max(0.45, Math.min(4, ui.cam.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    const after = toWorld(p.x, p.y);
    ui.cam.x += before.x - after.x; ui.cam.y += before.y - after.y; clampCam(); dirty = true;
  }, { passive: false });
  // two-finger pinch zoom and pan (touch / trackpad-free devices)
  (function () {
    let t0 = null;
    const info = (e) => { const a = e.touches[0], b = e.touches[1], r = canvas.getBoundingClientRect(); return { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top }; };
    canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { t0 = info(e); drag = null; e.preventDefault(); } }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2 || !t0) return; e.preventDefault();
      const t1 = info(e), before = toWorld(t0.x, t0.y);
      ui.cam.z = Math.max(0.45, Math.min(4, ui.cam.z * (t1.d / t0.d)));
      const after = toWorld(t1.x, t1.y);
      ui.cam.x += before.x - after.x; ui.cam.y += before.y - after.y; clampCam(); dirty = true; t0 = t1;
    }, { passive: false });
    canvas.addEventListener('touchend', () => { t0 = null; });
  })();
  function clampCam() { ui.cam.x = Math.max(0, Math.min(NAP.MAP.W, ui.cam.x)); ui.cam.y = Math.max(0, Math.min(NAP.MAP.H, ui.cam.y)); }
  function selArmy() { const s = S(); return s && ui.sel.army ? s.armies.find((a) => a.id === ui.sel.army) : null; }

  window.addEventListener('keydown', (e) => {
    if ($('#game').hidden || !$('#battle').hidden || !$('#modal').hidden) return;
    if (/input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'Enter') { endTurn(); e.preventDefault(); }
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
    beginGame('france');
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
    if (!dirty || $('#game').hidden || !S()) return;
    dirty = false;
    const s = S(), a = selArmy();
    const opts = ui.opts;
    opts.selProv = ui.sel.prov; opts.hoverProv = ui.hover;
    opts.selArmy = ui.sel.army; opts.pulse = ui.pulseProv || null;
    opts.targets = a && a.owner === s.player ? C.neighbors(a.owner, a.prov) : [];
    opts.seaFrom = a && a.owner === s.player && NAP.world.byId[a.prov].port ? a.prov : null;
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
