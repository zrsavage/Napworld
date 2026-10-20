/* NAPWORLD - tutorial steps, battle tips, practice battle and event illustrations */
(function () {
  const NAP = window.NAP;
  const G = (NAP.guide = {});

  // ------------------------------------------------------------------ event illustrations (inline SVG, period-print look)
  const SKY = { war: ['#6a3a2a', '#d99a52'], treaty: ['#d8c9a0', '#f0e5c4'], winter: ['#8d9aa8', '#dfe6ec'], revolt: ['#1c1830', '#5a2a2a'], boon: ['#7fb4d8', '#f3e6a8'], flags: ['#4a6a8a', '#e8d9a0'], disaster: ['#2c3038', '#6a6f78'], crown: ['#3a2a4a', '#c79a45'], sea: ['#496a85', '#d9c9a0'] };
  const ART_BY_ID = { coalition3: 'flags', coalition6: 'flags', trafalgar: 'sea', rhine: 'crown', hre: 'crown', hundred: 'crown', continental: 'treaty', prussiawar: 'war', austria1809: 'war', russia1812: 'winter', finnishwar: 'winter', fontainebleau: 'treaty', copenhagen: 'sea', tilsit: 'treaty', bucharest: 'treaty', vienna: 'treaty', wellesley: 'war', torres: 'war', leipzig: 'war', spain1808: 'revolt', serbia: 'revolt' };
  function soldiers(n, x0, y, color, scale) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + i * 16 * scale;
      s += `<g transform="translate(${x},${y}) scale(${scale})" fill="${color}"><rect x="-3" y="-18" width="6" height="14" rx="2"/><circle cx="0" cy="-22" r="3.6"/><rect x="-4.5" y="-27" width="9" height="3.5" rx="1"/><rect x="5" y="-34" width="1.6" height="30"/><path d="M5 -34 l1.6 -6 l1.6 6z"/></g>`;
    }
    return s;
  }
  function flag(x, y, color) { return `<g><rect x="${x}" y="${y}" width="2" height="44" fill="#3a2a1a"/><path d="M${x + 2} ${y} h30 l-8 8 l8 8 h-30z" fill="${color}" stroke="#2a1a0a" stroke-width="1"/></g>`; }
  G.eventArt = function (ev) {
    const kind = ev.art || ART_BY_ID[ev.id] || 'war';
    const [c0, c1] = SKY[kind] || SKY.war;
    let body = '';
    if (kind === 'war') body = `<circle cx="310" cy="58" r="22" fill="#f6d27a" opacity=".85"/><ellipse cx="90" cy="70" rx="70" ry="18" fill="#3a2a22" opacity=".55"/><ellipse cx="250" cy="62" rx="60" ry="14" fill="#3a2a22" opacity=".45"/>${soldiers(8, 70, 118, '#1c1814', 1)}${soldiers(6, 250, 118, '#1c1814', 1)}${flag(205, 74, '#c23a3a')}`;
    else if (kind === 'treaty') body = `<rect x="120" y="86" width="160" height="30" fill="#6a4a2a"/><rect x="140" y="52" width="120" height="48" rx="3" fill="#f4ecd2" stroke="#8a7a52"/><path d="M150 66h100M150 76h100M150 86h70" stroke="#6a5a3a" stroke-width="2"/><circle cx="238" cy="90" r="7" fill="#a22a2a"/><path d="M290 40 q30 -20 40 10 q-20 -5 -30 20z" fill="#e8dcc0" stroke="#8a7a52"/>`;
    else if (kind === 'winter') body = Array.from({ length: 34 }, (_, i) => `<circle cx="${(i * 47) % 400}" cy="${(i * 29) % 100}" r="${1.4 + (i % 3)}" fill="#fff" opacity=".85"/>`).join('') + `<rect x="0" y="108" width="400" height="22" fill="#f4f7fa"/>${soldiers(10, 40, 112, '#2a2a30', 0.9)}`;
    else if (kind === 'revolt') body = `<rect x="0" y="100" width="400" height="30" fill="#14101e"/>${[60, 130, 200, 270, 340].map((x) => `<rect x="${x}" y="64" width="3" height="36" fill="#5a3a1a"/><ellipse cx="${x + 1.5}" cy="58" rx="7" ry="11" fill="#ff9a2a"/><ellipse cx="${x + 1.5}" cy="60" rx="3.5" ry="6" fill="#ffe27a"/>`).join('')}${soldiers(12, 30, 118, '#0c0a14', 1)}`;
    else if (kind === 'boon') body = `<circle cx="70" cy="40" r="26" fill="#ffe27a"/><rect x="0" y="90" width="400" height="40" fill="#c9a54a"/>${Array.from({ length: 40 }, (_, i) => `<path d="M${i * 10 + 4} 112 q-3 -22 0 -26 q3 4 0 26" fill="#e3bd55" stroke="#8a6a1a" stroke-width=".6"/>`).join('')}`;
    else if (kind === 'flags') body = [50, 110, 170, 230, 290].map((x, i) => flag(x, 56, ['#c8283a', '#e2dcb4', '#2f7d4a', '#3fa7e0', '#a9d34a'][i])).join('') + `<rect x="0" y="108" width="400" height="22" fill="#3a4a3a" opacity=".5"/>`;
    else if (kind === 'disaster') body = `<ellipse cx="120" cy="38" rx="90" ry="22" fill="#12141a" opacity=".8"/><ellipse cx="290" cy="30" rx="80" ry="18" fill="#12141a" opacity=".8"/><path d="M210 40 l-14 30 h12 l-8 32 l26 -42 h-14 l12 -20z" fill="#ffe27a"/><rect x="0" y="108" width="400" height="22" fill="#2a2d33"/>`;
    else if (kind === 'crown') body = `<path d="M150 98 l-8 -46 l32 24 l26 -34 l26 34 l32 -24 l-8 46z" fill="#e0b146" stroke="#6a4a0a" stroke-width="2"/><rect x="150" y="98" width="104" height="12" fill="#c28a2a" stroke="#6a4a0a" stroke-width="2"/>${[168, 202, 236].map((x) => `<circle cx="${x}" cy="104" r="3.5" fill="#b02a2a"/>`).join('')}`;
    else if (kind === 'sea') body = `<path d="M0 96 q25 -12 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V130 H0z" fill="#2e4a63"/><g fill="#1c1814"><path d="M150 96 l6 -40 l24 36z"/><path d="M190 96 l2 -50 l30 44z"/><path d="M140 96 h90 l-10 10 h-70z"/></g><path d="M240 90 l4 -30 l18 26z" fill="#1c1814"/>`;
    return `<svg class="evart" viewBox="0 0 400 130" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sk${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs><rect width="400" height="130" fill="url(#sk${kind})"/>${body}<rect x="3" y="3" width="394" height="124" fill="none" stroke="#2a1c0a" stroke-width="3"/></svg>`;
  };

  // ------------------------------------------------------------------ campaign tutorial
  // Each step: id, title, text (HTML), pulse(S)->province id, hl: CSS selectors to highlight, check(ctx)->done (auto-advance), manual: show Next button
  G.STEPS = [
    { id: 'welcome', title: 'Welcome', manual: true, text: `You command the <b>French Empire</b> in January 1805. Britain is already at war with you, and the old monarchies of Europe are watching. This short tutorial walks through the essentials. You can skip it at any time.<br><br><b>Goal:</b> hold 55% of Europe's provinces (or eliminate every rival) before the end of 1815.` },
    { id: 'camera', title: 'Move around the map', manual: true, text: `<b>Drag</b> with the left mouse button to pan, use the <b>mouse wheel</b> to zoom, or click the <b>minimap</b> at the bottom left to jump anywhere. Province names appear as you zoom in. Each coloured region belongs to one nation; thick dark lines are national borders.` },
    { id: 'selprov', title: 'Select a province', text: `Click <b>Paris</b> (marked with a pulsing ring). The panel on the right shows what the province produces, its fortifications, its unrest, and what you can recruit or build there.`, pulse: () => 'paris', check: (c) => c.ui.sel.prov === 'paris' && !c.ui.sel.army },
    { id: 'panel', title: 'Gold, manpower and unrest', manual: true, text: `<b>Income</b> (gold) pays for regiments and buildings. <b>Manpower</b> is the soldiers you can recruit. Both are shown in the top bar. <b>Unrest</b> rises in conquered lands that you do not garrison, and above 60% it cuts income and eventually triggers a revolt. Use the <i>Policy</i> setting to trade tax for order.`, hl: ['#polpick'] },
    { id: 'recruit', title: 'Raise a regiment', text: `Click <b>Line Infantry</b> under <i>Recruit</i>. It costs gold and manpower and arrives in a turn or two. Mix infantry, cavalry and artillery for the best results. Hover any unit to see what it does; elite units (Grenadiers, Guard, Lancers...) need the right building in the province.`, hl: ['[data-rec="line"]'], check: (c) => c.S.provinces.paris.queue.length > 0 || c.S.armies.some((a) => a.prov === 'paris' && a.owner === c.S.player && a.units.length > 4) },
    { id: 'build', title: 'Invest in the province', text: `Now click <b>Market</b> under <i>Construction</i> (+50% income). Hover each building to see what it does: Barracks unlock Grenadiers, Stables unlock heavy cavalry, an Arsenal gives cheaper guns, and a Military Academy unlocks the Guard and trains veterans.`, hl: ['[data-bld="market"]'], check: (c) => !!c.S.provinces.paris.build || c.S.provinces.paris.market > 0 },
    { id: 'selarmy', title: 'Select an army', text: `Click the flag in <b>Normandy</b> showing a gold star &mdash; that is Napoleon's Grande Armee. You may need to zoom in a little. The side panel lists its regiments and general.`, pulse: () => 'normandy', check: (c) => { const a = c.S.armies.find((x) => x.id === c.ui.sel.army); return a && a.prov === 'normandy' || (a && a.owner === c.S.player && a.units.length >= 15); } },
    { id: 'army', title: 'Armies, generals and supply', manual: true, text: `Armies hold up to 20 regiments. A <b>general</b> boosts the whole army. Armies far from friendly soil run low on <b>supply</b> and suffer attrition, and <b>forced marches</b> (a checkbox) move two provinces per turn at the cost of men and fatigue. Tired armies fight worse. You can split, merge and disband regiments in the panel.` },
    { id: 'move', title: 'March!', text: `With the army selected, <b>right-click Belgium</b> to order a march there. A dashed line previews the route. Armies advance one province per turn, and cannot enter neutral nations' lands without a declaration of war.`, pulse: () => 'belgium', check: (c) => { const a = c.S.armies.find((x) => x.id === c.ui.sel.army); return a && (a.path.length > 0 || a.prov === 'belgium'); } },
    { id: 'endturn', title: 'End the turn', text: `Press <b>End Turn</b> (or <kbd>Enter</kbd>). Every nation moves at once. One turn is one month. After each turn you get a summary of income, battles and diplomatic news.`, hl: ['#endturn'], check: (c) => c.S.turn >= 1 },
    { id: 'diplo', title: 'Diplomacy', text: `Open <b>Diplomacy</b> from the top bar. Here you can declare war, propose alliances, and negotiate peace. When you make peace you choose the <b>terms</b>: gold or provinces to demand, or concessions to offer. Your <b>war score</b> &mdash; battles won and provinces taken &mdash; decides what the enemy will accept.`, hl: ['#b-dip'], check: (c) => c.ui.dipOpened },
    { id: 'sea', title: 'Sea routes', manual: true, text: `Unless you switched on naval warfare, there are no fleets. Ports are linked by <b>sea routes</b> (select an army in a port to see the dashed lines) which armies of up to 12 regiments can cross in one turn. Only <b>short crossings</b> work like this (the Channel, the Baltic straits, the Adriatic...); a long voyage hops from port to port, one crossing per turn. This is how Britain can land troops on the continent, and how you can invade Britain.` },
    { id: 'battle', title: 'Battles', manual: true, practice: true, text: `When armies meet you can <b>auto-resolve</b> or <b>fight</b> the battle yourself. Fighting lets you deploy your regiments, use formations and flank the enemy. Weather, time of day, terrain and fortifications all matter. Want to try? Hit <b>Practice battle</b> below &mdash; it won't affect your campaign.` },
    { id: 'siege', title: 'Sieges, assaults and rebellion', manual: true, text: `To take a province, move an army in and hold it. Fortified provinces need several turns of siege (artillery speeds this up), or you can <b>storm the walls</b> at a cost in men. Conquered provinces need a garrison or they will revolt, so do not spread your army too thin.` },
    { id: 'done', title: 'You are ready, Emperor', manual: true, last: true, text: `You now know the basics. Watch the <b>Dispatches</b> panel for news, keep your treasury positive, and pick your fights. Historical events &mdash; coalitions, uprisings, winters &mdash; will shape the war. Replay any lesson, with its animated demo, from the <b>Lessons</b> button in the top bar, or press <b>How to play (?)</b> any time for a reminder. For a first real campaign we suggest <b>Russia</b> (the gentlest start) or <b>Britain</b> (safe and rich); France, the nation in this tutorial, is much harder. Vive l'Empereur!` }
  ];

  // ------------------------------------------------------------------ animated demos shown in the tutorial panel
  // A tiny stylised mock of the campaign screen with a ghost cursor that performs each lesson on a loop.
  const DW = 300, DH = 176;
  const BOX = { paris: [92, 56, 50, 40], normandy: [30, 62, 58, 40], belgium: [100, 30, 66, 24], burgundy: [92, 100, 60, 36], champagne: [146, 58, 52, 38], britain: [8, 28, 50, 24] };
  const PT = (id) => { const b = BOX[id]; return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
  const BTN = { line: [214, 54, 76, 16], market: [214, 74, 76, 16], end: [232, 3, 62, 16], diplo: [150, 3, 56, 16] };
  const BP = (id) => { const b = BTN[id]; return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
  const target = (t) => (Array.isArray(t) ? t : BOX[t] ? PT(t) : BTN[t] ? BP(t) : t === 'army' ? [52, 82] : t === 'mini' ? [20, 156] : [150, 90]);
  // scripts: each step moves the cursor to a target, then does something there
  const SCRIPTS = {
    camera: [{ to: [120, 100], do: 'grab', cap: 'Drag with the left button to pan' }, { to: [170, 90], do: 'drag', cap: '' }, { to: [150, 90], do: 'zoom', cap: 'Mouse wheel to zoom in and out' }, { to: 'mini', do: 'click', cap: 'Or click the minimap to jump' }],
    selprov: [{ to: 'paris', do: 'sel', cap: 'Click Paris' }, { to: 'paris', do: 'wait', cap: 'The panel shows what it produces' }],
    panel: [{ to: [60, 11], do: 'flash:top', cap: 'Gold and manpower live in the top bar' }, { to: 'paris', do: 'sel', cap: 'Unrest and income are in the province panel' }],
    recruit: [{ to: 'paris', do: 'sel', cap: 'Select your province' }, { to: 'line', do: 'press:line', cap: 'Click Line Infantry to recruit' }, { to: 'line', do: 'wait', cap: 'It arrives in a turn or two' }],
    build: [{ to: 'paris', do: 'sel', cap: 'Select your province' }, { to: 'market', do: 'press:market', cap: 'Click Market: +50% income' }, { to: 'market', do: 'wait', cap: 'Buildings are permanent upgrades' }],
    selarmy: [{ to: 'army', do: 'selarmy', cap: 'Click the flag with the gold star' }, { to: 'army', do: 'wait', cap: 'The panel lists its regiments and general' }],
    move: [{ to: 'army', do: 'selarmy', cap: 'Select the army' }, { to: 'belgium', do: 'route', cap: 'Right-click where it should march' }, { to: 'belgium', do: 'wait', cap: 'A dashed line shows the route' }],
    endturn: [{ to: 'end', do: 'turn', cap: 'End Turn: one turn is one month' }, { to: 'end', do: 'wait', cap: 'Every nation moves, then you get a report' }],
    diplo: [{ to: 'diplo', do: 'diplo', cap: 'Open Diplomacy' }, { to: [92, 80], do: 'wait', cap: 'Declare war, ally, trade, negotiate peace' }]
  };
  const wrap = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  function mockScene(c, steps, t, st) {
    // timeline: every step = 0.9 s travel + 0.9 s doing; loop with a 1 s pause
    const T = 1.8, total = steps.length * T + 1.0, tt = Math.max(0, t) % total;
    const i = Math.min(steps.length - 1, Math.floor(tt / T)), ph = tt - i * T;
    if (i !== st.i || tt < st.tt) { if (tt < st.tt) Object.assign(st, { sel: null, panel: false, army: false, route: null, toast: '', pressed: null, built: false, queued: 0, date: 0, armyAt: 'normandy', ox: 0, zoom: 1, diplo: false, flash: 0 }); st.i = i; st.done = false; }
    st.tt = tt;
    const step = steps[i], prev = i ? target(steps[i - 1].to) : [150, 140], to = target(step.to);
    const k = Math.min(1, ph / 0.9), e = k * k * (3 - 2 * k);
    const cur = [prev[0] + (to[0] - prev[0]) * e, prev[1] + (to[1] - prev[1]) * e];
    if (ph >= 0.9 && !st.done) { st.done = true; const d = step.do; st.click = { x: to[0], y: to[1], t: 0, r: d === 'route' }; st.cap = step.cap;
      if (d === 'sel') { st.sel = step.to; st.panel = true; } else if (d === 'selarmy') { st.army = true; st.panel = true; st.sel = 'normandy'; }
      else if (d === 'route') { st.route = { t: 0 }; } else if (d === 'turn') { st.date++; if (st.route) { st.armyAt = 'belgium'; st.route = null; } else st.date = st.date; }
      else if (d.startsWith('press:')) { st.pressed = d.slice(6); st.flash = 0; if (d === 'press:line') st.queued++; else st.built = true; }
      else if (d === 'diplo') st.diplo = true; else if (d.startsWith('flash:')) st.flash = 1; else if (d === 'drag') st.ox = 26; else if (d === 'zoom') st.zoom = 1.25; }
    if (ph < 0.9) st.cap = step.cap;
    if (st.click) st.click.t += 1 / 60;
    if (st.route && st.route.t < 1) st.route.t += 1 / 50;
    // ---- draw
    c.clearRect(0, 0, DW, DH); c.fillStyle = '#7fa6b8'; c.fillRect(0, 0, DW, DH);
    c.save(); c.translate(st.ox || 0, 0); c.translate(100, 90); c.scale(st.zoom || 1, st.zoom || 1); c.translate(-100, -90);
    const prov = (id, col, name) => { const b = BOX[id]; wrap(c, b[0], b[1], b[2], b[3], 8); c.fillStyle = col; c.fill(); c.lineWidth = st.sel === id ? 2.5 : 1; c.strokeStyle = st.sel === id ? '#fff' : 'rgba(20,16,10,.7)'; c.stroke(); c.fillStyle = 'rgba(255,255,255,.92)'; c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText(name, b[0] + b[2] / 2, b[1] + b[3] / 2 + (id === 'paris' ? 14 : 3)); };
    prov('britain', '#c8283a', 'Britain'); prov('normandy', '#2a52be', 'Normandy'); prov('paris', '#2a52be', 'Paris'); prov('belgium', '#2a52be', 'Belgium'); prov('burgundy', '#2a52be', 'Burgundy'); prov('champagne', '#2a52be', 'Lorraine');
    const ax = st.armyAt === 'belgium' ? PT('belgium') : [52, 82];
    c.fillStyle = '#ffd24a'; c.font = 'bold 13px sans-serif'; c.fillText('★', PT('paris')[0], PT('paris')[1] - 3);
    wrap(c, ax[0] - 9, ax[1] - 7, 18, 13, 3); c.fillStyle = '#2a52be'; c.fill(); c.strokeStyle = st.army ? '#fff' : '#111'; c.lineWidth = st.army ? 2.2 : 1; c.stroke(); c.fillStyle = '#ffd24a'; c.font = '9px sans-serif'; c.fillText('★ 9', ax[0], ax[1] + 3);
    if (st.route) { const A = [52, 82], B = PT('belgium'), f = Math.min(1, st.route.t); c.setLineDash([4, 3]); c.strokeStyle = '#ffe27a'; c.lineWidth = 2; c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f); c.stroke(); c.setLineDash([]); }
    c.restore();
    // side panel
    wrap(c, 208, 26, 90, 146, 6); c.fillStyle = 'rgba(18,22,30,.96)'; c.fill(); c.strokeStyle = '#555'; c.stroke();
    c.fillStyle = '#e8d9a0'; c.font = 'bold 10px sans-serif'; c.textAlign = 'left'; c.fillText(st.panel ? (st.army ? 'French army' : (st.sel === 'paris' ? 'Paris' : 'Province')) : 'Select something', 214, 40);
    if (st.panel) { const bt = (id, label, on) => { const b = BTN[id]; wrap(c, b[0], b[1], b[2], b[3], 4); c.fillStyle = st.pressed === id && st.click && st.click.t < 0.4 ? '#ffd54a' : on ? '#3a5a3a' : '#2c3442'; c.fill(); c.strokeStyle = '#667'; c.stroke(); c.fillStyle = on ? '#cfc' : '#ddd'; c.font = '9px sans-serif'; c.fillText(label, b[0] + 5, b[1] + 11); };
      if (!st.army) { bt('line', 'Line Infantry  90g', false); bt('market', st.built ? '✔ Market (built)' : 'Market  220g', st.built); if (st.queued) { c.fillStyle = '#ffd54a'; c.font = '9px sans-serif'; c.fillText('In training: Line x' + st.queued, 214, 104); } }
      else { c.fillStyle = '#ddd'; c.font = '9px sans-serif'; ['9 regiments', 'General: Napoleon', 'Supply: at home'].forEach((l, q) => c.fillText(l, 214, 56 + q * 13)); } }
    // top bar
    c.fillStyle = 'rgba(12,16,24,.97)'; c.fillRect(0, 0, DW, 24); c.fillStyle = st.flash ? '#ffd54a' : '#e8d9a0'; c.font = 'bold 10px sans-serif'; c.textAlign = 'left'; c.fillText('● 900g   ☖ 10,150', 6, 15);
    const tb = (id, label, hot) => { const b = BTN[id]; wrap(c, b[0], b[1], b[2], b[3], 4); c.fillStyle = hot ? '#b08a2a' : '#2c3442'; c.fill(); c.strokeStyle = '#778'; c.stroke(); c.fillStyle = '#fff'; c.font = '9px sans-serif'; c.textAlign = 'center'; c.fillText(label, b[0] + b[2] / 2, b[1] + 11); };
    tb('diplo', 'Diplomacy', false); tb('end', 'End Turn', true); c.fillStyle = '#ccc'; c.font = '9px sans-serif'; c.textAlign = 'left'; c.fillText(['Jan', 'Feb', 'Mar', 'Apr'][st.date % 4] + ' 1805', 100, 15);
    if (st.diplo) { wrap(c, 60, 50, 150, 96, 6); c.fillStyle = 'rgba(20,24,32,.97)'; c.fill(); c.strokeStyle = '#d9b44a'; c.stroke(); c.fillStyle = '#e8d9a0'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('Diplomacy', 135, 66); c.fillStyle = '#ddd'; c.font = '9px sans-serif'; ['Britain   WAR', 'Spain   Ally', 'Austria  Neutral'].forEach((l, q) => c.fillText(l, 135, 86 + q * 14)); c.fillStyle = '#9c9'; c.fillText('[Declare war] [Ally] [Peace]', 135, 134); }
    // cursor + click ring
    if (st.click && st.click.t < 0.5) { c.strokeStyle = st.click.r ? '#ff8a6a' : '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(st.click.x, st.click.y, 3 + st.click.t * 30, 0, 6.3); c.globalAlpha = 1 - st.click.t * 2; c.stroke(); c.globalAlpha = 1; }
    c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 1; c.beginPath(); c.moveTo(cur[0], cur[1]); c.lineTo(cur[0] + 11, cur[1] + 5); c.lineTo(cur[0] + 6, cur[1] + 7); c.lineTo(cur[0] + 8, cur[1] + 13); c.lineTo(cur[0] + 5, cur[1] + 14); c.lineTo(cur[0] + 3, cur[1] + 8); c.lineTo(cur[0], cur[1] + 11); c.closePath(); c.fill(); c.stroke();
    // caption
    if (st.cap) { c.font = 'bold 11px sans-serif'; const w = c.measureText(st.cap).width + 14; wrap(c, 6, DH - 24, Math.min(DW - 12, w), 18, 5); c.fillStyle = 'rgba(0,0,0,.72)'; c.fill(); c.fillStyle = '#ffe27a'; c.textAlign = 'left'; c.fillText(st.cap, 13, DH - 11); }
  }
  // self-contained animated explainers for the lessons that are not point-and-click
  const DRAW = {
    welcome(c, t) { c.fillStyle = '#243040'; c.fillRect(0, 0, DW, DH); for (let i = 0; i < 9; i++) { const x = ((i * 40 + t * 22) % 340) - 20; c.fillStyle = '#10141c'; c.fillRect(x, 120 - (i % 3) * 4, 7, 22); c.beginPath(); c.arc(x + 3.5, 116 - (i % 3) * 4, 4, 0, 6.3); c.fill(); c.fillRect(x + 8, 96 - (i % 3) * 4, 1.5, 38); }
      c.fillStyle = '#f1d487'; c.font = 'bold 15px serif'; c.textAlign = 'center'; c.fillText('Europe, 1805', DW / 2, 50); c.font = '11px sans-serif'; c.fillText('Hold 55% of the provinces. Outlast the coalitions.', DW / 2, 70); },
    army(c, t) { c.fillStyle = '#7fa6b8'; c.fillRect(0, 0, DW, DH); c.fillStyle = '#c9b98a'; c.fillRect(0, 70, DW, 70); c.fillStyle = '#2a52be'; c.fillRect(0, 70, 90, 70); c.fillStyle = '#d9d0b0'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('home', 45, 128);
      const x = 40 + ((t * 30) % 200); c.fillStyle = '#2a52be'; c.fillRect(x - 10, 92, 20, 14); c.fillStyle = '#ffd24a'; c.fillText('★', x, 103); const far = Math.max(0, Math.min(1, (x - 90) / 150)); c.fillStyle = '#000a'; c.fillRect(20, 26, 140, 10); c.fillStyle = far > 0.5 ? '#e55' : far > 0.1 ? '#ec3' : '#4c4'; c.fillRect(20, 26, 140 * (1 - far), 10); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText('Supply', 166, 35); c.fillText(far > 0.5 ? 'Far from home: attrition!' : 'Stay close to friendly land', 20, 56); },
    sea(c, t) { c.fillStyle = '#4f7f9c'; c.fillRect(0, 0, DW, DH); c.fillStyle = '#c9b98a'; c.fillRect(0, 0, 70, DH); c.fillRect(230, 0, 70, DH); c.fillStyle = '#fff'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('Port', 35, 90); c.fillText('Port', 265, 90); c.setLineDash([5, 4]); c.strokeStyle = '#ffe27a'; c.beginPath(); c.moveTo(60, 88); c.lineTo(240, 88); c.stroke(); c.setLineDash([]);
      const x = 60 + ((t * 60) % 180); c.fillStyle = '#2a2018'; c.beginPath(); c.moveTo(x - 12, 92); c.lineTo(x + 12, 92); c.lineTo(x + 7, 100); c.lineTo(x - 8, 100); c.closePath(); c.fill(); c.fillStyle = '#f4ecd2'; c.fillRect(x - 1, 74, 2, 18); c.beginPath(); c.moveTo(x + 2, 76); c.lineTo(x + 12, 90); c.lineTo(x + 2, 90); c.fill(); c.fillStyle = '#fff'; c.fillText('Armies cross between ports in one turn', 150, 140); },
    battle(c, t) { c.fillStyle = '#7b9a55'; c.fillRect(0, 0, DW, DH); const volley = (Math.floor(t * 1.5) % 2);
      for (let i = 0; i < 4; i++) { c.fillStyle = '#2a52be'; c.fillRect(40, 40 + i * 26, 14, 20); c.fillStyle = '#c8283a'; c.fillRect(246, 40 + i * 26, 14, 20); }
      c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { const f = (t * 1.5) % 1; c.fillRect(56 + f * 180, 50 + i * 26, 5, 1.5); c.fillRect(244 - f * 180, 52 + i * 26, 5, 1.5); }
      const cx = 60 + ((t * 40) % 150); c.fillStyle = '#e8c04a'; c.fillRect(cx, 14, 16, 8); c.strokeStyle = '#ffe27a'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(60, 18); c.lineTo(250, 18); c.lineTo(250, 40); c.stroke(); c.setLineDash([]); c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('Fire from range, then flank with cavalry', 150, 160); },
    siege(c, t) { c.fillStyle = '#9ab06a'; c.fillRect(0, 0, DW, DH); c.fillStyle = '#8a7a62'; c.fillRect(170, 40, 90, 80); for (let i = 0; i < 5; i++) c.fillRect(170 + i * 20, 32, 12, 10); c.fillStyle = '#e8d9a0'; c.font = '10px sans-serif'; c.textAlign = 'center'; c.fillText('Fort', 215, 84);
      for (let i = 0; i < 3; i++) { c.fillStyle = '#2a2018'; c.fillRect(40, 56 + i * 24, 18, 8); c.beginPath(); c.arc(44, 68 + i * 24, 4, 0, 6.3); c.fill(); const f = ((t * 1.2) + i * 0.3) % 1; c.fillStyle = '#222'; c.beginPath(); c.arc(62 + f * 106, 60 + i * 24, 2.5, 0, 6.3); c.fill(); }
      const prog = (t * 0.2) % 1; c.fillStyle = '#000a'; c.fillRect(60, 150, 180, 10); c.fillStyle = '#ec3'; c.fillRect(60, 150, 180 * prog, 10); c.fillStyle = '#fff'; c.fillText('Siege progress: walls fall in a few turns (or storm them)', 150, 144); }
  };
  const DEMO_FOR = { welcome: 'welcome', camera: 'camera', selprov: 'selprov', panel: 'panel', recruit: 'recruit', build: 'build', selarmy: 'selarmy', army: 'army', move: 'move', endturn: 'endturn', diplo: 'diplo', sea: 'sea', battle: 'battle', siege: 'siege', done: 'welcome' };
  // start an animation in a canvas; returns {stop()}
  G.playDemo = function (canvas, stepId) {
    const id = DEMO_FOR[stepId], c = canvas.getContext('2d'); canvas.width = DW; canvas.height = DH;
    let raf = 0, t0 = performance.now(), dead = false; const st = { i: -1, tt: 99, sel: null, panel: false, army: false, route: null, pressed: null, built: false, queued: 0, date: 0, armyAt: 'normandy', ox: 0, zoom: 1, diplo: false, flash: 0 };
    const frame = (now) => { if (dead) return; const t = (now - t0) / 1000; if (SCRIPTS[id]) mockScene(c, SCRIPTS[id], t, st); else if (DRAW[id]) DRAW[id](c, t); raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame);
    return { stop() { dead = true; cancelAnimationFrame(raf); } };
  };

  // ------------------------------------------------------------------ battle tutorial
  // first-time hint cards for Learning mode: shown once each, when the situation first comes up
  G.HINTS = [
    { id: 'supply', title: 'Supply', when: (S, C) => C.armiesOf(S.player).some((a) => (a.supply || 0) >= 2), text: 'One of your armies is far from friendly land and is <b>running short of supply</b>: it loses men every turn. Move it back toward your own or an allied province, or tick <i>Forage</i> in its panel to live off the land at the cost of angering the province.' },
    { id: 'siege-def', title: 'A province is besieged', when: (S, C) => C.provincesOf(S.player).some((p) => S.provinces[p.id].siege), text: 'An enemy is <b>besieging</b> one of your provinces. Fortifications make it last longer. A relief army marching into the province breaks the siege, so bring one if you can. Local militia will already be fighting for it.' },
    { id: 'siege-att', title: 'Besieging', when: (S, C) => C.armiesOf(S.player).some((a) => S.provinces[a.prov].siege && S.provinces[a.prov].siege.by === S.player), text: 'Your army is <b>besieging</b> a province. Keep it there: each turn adds to the siege until the walls fall. Artillery speeds it up, and you can <i>Storm the walls</i> for a quick (costly) assault.' },
    { id: 'unrest', title: 'Unrest', when: (S, C) => C.provincesOf(S.player).some((p) => (S.provinces[p.id].unrest || 0) >= 30), text: 'A province is getting restless. <b>Unrest</b> rises in conquered land and under heavy taxation; at 60% it spawns <b>rebel guerrilla bands</b> that raid the province (income and recruiting cut) and fight your troops, and at 100% the province revolts and is lost. Set the province policy to <i>Martial law</i>, or station an army there: any army in the province keeps the rebels from rising.' },
    { id: 'lowgold', title: 'Watch the treasury', when: (S, C, me) => me.gold < 60, text: 'Your gold is almost gone. Regiments cost <b>upkeep</b> every month, and if you cannot pay them they desert. Disband weak regiments, set a rich province to <i>Heavy taxation</i>, or make peace.' },
    { id: 'blockade', title: 'Blockade', when: (S, C) => C.provincesOf(S.player).some((p) => S.provinces[p.id].blockade), text: 'An enemy fleet is <b>blockading</b> one of your ports: its income is halved and nothing can be built there. Build ships at a Shipyard or make peace to lift it.' },
    { id: 'firstbattle', title: 'Battles', when: (S, C, me) => (me.wonBattles || 0) + (me.lostBattles || 0) >= 1, text: 'You have fought your first battle. Victories raise your regiments\' experience, and a defeated army retreats, so <b>chase it</b> before it recovers. Armies that lose many men can be reinforced for gold and manpower in friendly territory.' },
    { id: 'general', title: 'Generals', when: (S, C) => C.attention(S.player).some((x) => x.kind === 'general'), text: 'An army with no general is weaker. Select it and use <i>Appoint general</i>. A general can only command so many regiments at once, so very large armies fight better when split under several leaders.' },
    { id: 'unlock', title: 'More tools unlocked', when: (S) => S.turn >= 5, text: 'The <b>Armies</b> list (key A), the <b>War overview</b> (key W) and the playback setting are now available in the top bar. The Armies list lets you reinforce or merge every army at once.' }
  ];
  G.BATTLE_TIPS = [
    { id: 'deploy', when: (B) => B.deployPhase, text: '<b>Deployment.</b> Drag a box to select regiments, then right-click inside the blue zone to place them, or right-drag a line to form a battle line. Use F1-F4 to change formation (F1 Line, F2 Column, F3 Square, F4 Skirmish); Ctrl+1-9 saves a control group, the digit recalls it. Faint cones show each regiment\'s range (press <b>V</b> to hide them). Press <b>Space</b> when ready.' },
    { id: 'advance', when: (B) => !B.deployPhase && B.t < 25, text: '<b>Advance.</b> Right-click an enemy regiment to attack it: infantry march to musket range (about 140 px) and fire. Artillery fires on its own up to 480 px &mdash; protect it. The green bar above each unit is morale, the white bar is strength.' },
    { id: 'range', when: (B) => B.t >= 25 && B.enemies(0).some((u) => B.friends(0).some((m) => Math.hypot(m.x - u.x, m.y - u.y) < 160)), text: '<b>Firefights.</b> Units in <b>line</b> shoot best, <b>columns</b> move fast but shoot poorly. Shots from the <b>flank or rear</b> hurt far more and shake morale, so try to turn the enemy line.' },
    { id: 'cav', when: (B) => B.enemies(0).some((u) => u.cls === 'cav' && u.charging), text: '<b>Cavalry charge!</b> Select the threatened infantry and press <b>3</b> to form <b>square</b>. Squares are nearly immune to cavalry but vulnerable to artillery and musket fire.' },
    { id: 'rout', when: (B) => B.friends(0).some((u) => u.state === 'routing'), text: '<b>A regiment is breaking.</b> Routing units flee and spread panic. Keep your general (the star) close to them and press <b>R</b> to rally them. Generals also boost the morale and firepower of nearby units.' },
    { id: 'win', when: (B) => B.t > 60, text: 'Break the enemy army: when most of their regiments are routed or destroyed you win. The battle starts at half speed. Use the speed buttons (&frac14;x to 4x) or + / &minus; to change it, and Space to pause and plan.' }
  ];

  G.practiceSpec = function () {
    const mk = (f, spec, gen) => {
      const units = [];
      spec.split(' ').forEach((t) => { const [k, n] = t.split(':'); for (let i = 0; i < +n; i++) { const u = { type: k, men: NAP.UNITS[k].men, max: NAP.UNITS[k].men }; units.push({ ref: u, type: k, men: u.men, max: u.max, faction: f, fatigue: 0 }); } });
      return { faction: f, units, general: gen };
    };
    return {
      terrain: 'h', provName: 'Practice Field', playerIsAttacker: true, fort: 0, fortSide: -1, weather: 'clear', tod: 'day', month: 6, tutorial: true,
      sides: [mk('france', 'line:5 light:1 art:2 hussar:1', { id: 0, name: 'Napoleon (practice)', atk: 5, def: 5, lead: 5 }), mk('austria', 'line:5 light:1 art:1 cuirass:2', { id: 0, name: 'Archduke Charles (practice)', atk: 3, def: 3, lead: 3 })]
    };
  };
})();
