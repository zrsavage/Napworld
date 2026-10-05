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
    { id: 'welcome', title: 'Welcome to Napworld', manual: true, text: `You command the <b>French Empire</b> in January 1805. Britain is already at war with you, and the old monarchies of Europe are watching. This short tutorial walks through the essentials. You can skip it at any time.<br><br><b>Goal:</b> hold 55% of Europe's provinces (or eliminate every rival) before the end of 1815.` },
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
    { id: 'sea', title: 'Sea routes', manual: true, text: `There are no fleets in Napworld. Ports are linked by <b>sea routes</b> (select an army in a port to see the dashed lines) which armies of up to 12 regiments can cross in one turn. This is how Britain can land troops on the continent, and how you can invade Britain.` },
    { id: 'battle', title: 'Battles', manual: true, practice: true, text: `When armies meet you can <b>auto-resolve</b> or <b>fight</b> the battle yourself. Fighting lets you deploy your regiments, use formations and flank the enemy. Weather, time of day, terrain and fortifications all matter. Want to try? Hit <b>Practice battle</b> below &mdash; it won't affect your campaign.` },
    { id: 'siege', title: 'Sieges, assaults and rebellion', manual: true, text: `To take a province, move an army in and hold it. Fortified provinces need several turns of siege (artillery speeds this up), or you can <b>storm the walls</b> at a cost in men. Conquered provinces need a garrison or they will revolt, so do not spread your army too thin.` },
    { id: 'done', title: 'You are ready, Emperor', manual: true, last: true, text: `You now know the basics. Watch the <b>Dispatches</b> panel for news, keep your treasury positive, and pick your fights. Historical events &mdash; coalitions, uprisings, winters &mdash; will shape the war. Press <b>How to play (?)</b> any time for a reminder. For a first real campaign we suggest <b>Russia</b> (the gentlest start) or <b>Britain</b> (safe and rich); France, the nation in this tutorial, is much harder. Vive l'Empereur!` }
  ];

  // ------------------------------------------------------------------ battle tutorial
  G.BATTLE_TIPS = [
    { id: 'deploy', when: (B) => B.deployPhase, text: '<b>Deployment.</b> Drag a box to select regiments, then right-click inside the blue zone to place them, or right-drag a line to form a battle line. Use F1-F4 to change formation (F1 Line, F2 Column, F3 Square, F4 Skirmish); Ctrl+1-9 saves a control group, the digit recalls it. Press <b>Space</b> when ready.' },
    { id: 'advance', when: (B) => !B.deployPhase && B.t < 25, text: '<b>Advance.</b> Right-click an enemy regiment to attack it: infantry march to musket range (about 95 px) and fire. Artillery fires on its own up to 330 px &mdash; protect it. The green bar above each unit is morale, the white bar is strength.' },
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
