/* NAPWORLD - campaign layer: state, economy, movement, sieges, diplomacy, AI, events */
(function () {
  const NAP = window.NAP;
  const C = (NAP.C = {});
  let S = null;
  const F = (id) => NAP.FACTIONS[id];
  const U = NAP.UNITS;
  const rnd = Math.random;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pkey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const INCOME_K = 8;
  const MP_K = 25;
  const MAX_STACK = 20;
  const SEA_CAP = 12; // regiments a single sea crossing can carry (water logistics)
  const WIN_SHARE = 0.55;
  const COLONIAL = { britain: 16, spain: 9, portugal: 5, france: 4, denmark: 3, ottoman: 2 };
  NAP.MONTHS = MONTHS;

  // Hooks are replaced by the UI. Defaults let the sim run headless (everything auto).
  C.hooks = {
    askBattle: async () => 'auto',
    runBattle: null,
    event: async () => 0,
    offer: async () => false,
    notify: () => {},
    refresh: () => {}
  };
  const H = () => C.hooks;

  C.get = () => S;
  C.set = (s) => { S = s; };
  C.def = (id) => NAP.world.byId[id];
  const W = () => NAP.world;

  // -------------------------------------------------------------------- state
  C.newGame = function (player, difficulty) {
    const w = W();
    S = {
      player, difficulty: difficulty || 'normal', turn: 0, year: 1805, month: 1,
      provinces: {}, factions: {}, armies: [], generals: {}, pool: {}, wars: {}, allies: {}, rel: {},
      log: [], fired: {}, nextArmy: 1, nextGen: 1, winner: null, msgs: [], report: {}
    };
    for (const p of w.provs) {
      S.provinces[p.id] = { id: p.id, owner: p.owner, fort: p.fort, market: 0, barracks: 0, build: null, queue: [], siege: null, unrest: 0, policy: 'balanced' };
    }
    for (const p of w.provs) {
      if (!p.capital) continue;
      const ps = S.provinces[p.id];
      ps.barracks = 1; ps.stables = 1; ps.arsenal = 1;
      if (['france', 'britain', 'austria', 'prussia', 'russia'].includes(p.owner)) ps.academy = 1;
    }
    for (const id in NAP.FACTIONS) {
      const n = w.provs.filter((p) => p.owner === id).length;
      const cap = w.provs.find((p) => p.owner === id && p.capital);
      S.factions[id] = {
        id, alive: n > 0, gold: Math.round(F(id).gold * 1.5), manpower: 2500 + n * 450,
        incomeMult: 1, cap: cap ? cap.id : null, wonBattles: 0, lostBattles: 0
      };
      S.pool[id] = [];
    }
    for (const g of NAP.GENERALS) {
      const id = S.nextGen++;
      S.generals[id] = { id, name: g[0], owner: g[1], atk: g[2], def: g[3], lead: g[4], from: g[5], trait: g[6], xp: 0, lvl: 1, alive: true, assigned: null, arrived: g[5] <= 1805 };
      if (g[5] <= 1805) S.pool[g[1]].push(id);
    }
    for (const f in NAP.START_ARMIES) {
      for (const [prov, gname, spec] of NAP.START_ARMIES[f]) {
        const army = C.makeArmy(f, prov, parseSpec(spec));
        if (gname) {
          const g = Object.values(S.generals).find((x) => x.name === gname);
          if (g) C.assignGeneral(army, g.id);
        }
      }
    }
    for (const [a, b] of NAP.START_WARS) S.wars[pkey(a, b)] = { since: 0, exh: 0, s: {} };
    for (const [a, b] of NAP.START_ALLIES) S.allies[pkey(a, b)] = true;
    for (const [a, b, v] of NAP.START_REL) S.rel[pkey(a, b)] = v;
    for (const k in S.allies) S.rel[k] = Math.max(S.rel[k] || 0, 60);
    S.truce = { [pkey('austria', 'bavaria')]: 22, [pkey('russia', 'ottoman')]: 6 };
    S.factions.france.incomeMult = 1.1; // Napoleon's France at its height (fades in 1812)
    C.log(`Year 1805. ${F(player).leader} leads the ${F(player).name}. Europe is on the brink of a new war.`, 'info');
    NAP.recolor(S);
    return S;
  };

  function parseSpec(spec) {
    const out = [];
    spec.split(' ').forEach((t) => {
      const [k, n] = t.split(':');
      for (let i = 0; i < +n; i++) out.push(C.newUnit(k));
    });
    return out;
  }
  C.newUnit = (type, vet) => ({ type, men: U[type].men, max: U[type].men, xp: 0, vet: vet || 0 });
  // veteran level: from an Academy at recruitment or from battles survived and won
  C.vetOf = (u) => Math.max(u.vet || 0, (u.xp || 0) >= 6 ? 2 : (u.xp || 0) >= 3 ? 1 : 0);
  C.unitCost = function (pid, type) {
    const u = U[type], ps = S.provinces[pid];
    let c = u.cost;
    if (u.cls === 'art' && ps.arsenal) c *= 0.8;
    if (u.cls === 'cav' && ps.stables) c *= 0.9;
    return Math.round(c);
  };
  C.makeArmy = function (owner, prov, units) {
    const a = { id: S.nextArmy++, owner, prov, units, general: null, path: [], from: prov, moved: false };
    S.armies.push(a);
    return a;
  };
  C.assignGeneral = function (army, gid) {
    if (army.general) { const old = S.generals[army.general]; if (old) old.assigned = null; if (old && old.alive) S.pool[old.owner].push(old.id); }
    const g = S.generals[gid];
    army.general = gid; g.assigned = army.id;
    const pl = S.pool[g.owner]; const i = pl.indexOf(gid); if (i >= 0) pl.splice(i, 1);
  };

  C.log = function (text, kind, facs) {
    S.log.push({ t: S.turn, text, kind: kind || 'info' });
    (S.turnLog = S.turnLog || []).push({ text, kind: kind || 'info' });
    if (S.log.length > 300) S.log.shift();
    H().notify(text, kind || 'info', facs);
  };
  // Log only if the player is involved
  function plog(text, kind, facs) {
    if (!facs || facs.includes(S.player)) C.log(text, kind, facs);
  }

  // -------------------------------------------------------------------- queries
  const atWar = (a, b) => a !== b && !!S.wars[pkey(a, b)];
  const allied = (a, b) => a !== b && !!S.allies[pkey(a, b)];
  C.atWar = atWar; C.allied = allied;
  C.rel = (a, b) => S.rel[pkey(a, b)] || 0;
  const addRel = (a, b, d) => { const k = pkey(a, b); S.rel[k] = clamp((S.rel[k] || 0) + d, -100, 100); };
  C.provincesOf = (f) => W().provs.filter((p) => S.provinces[p.id].owner === f);
  C.armiesOf = (f) => S.armies.filter((a) => a.owner === f);
  C.dateStr = () => `${MONTHS[S.month - 1]} ${S.year}`;
  C.armyPower = (a) => a.units.reduce((s, u) => s + u.men * U[u.type].power * (1 + 0.06 * C.vetOf(u)), 0) * generalMul(a);
  function generalMul(a) {
    if (!a.general) return 1;
    const g = S.generals[a.general];
    return 1 + (g.atk + g.def + g.lead - 9) * 0.03;
  }
  C.generalOf = (a) => (a.general ? S.generals[a.general] : null);
  C.armyMen = (a) => a.units.reduce((s, u) => s + u.men, 0);
  const factionPower = (f) => C.armiesOf(f).reduce((s, a) => s + C.armyPower(a), 0);
  C.factionPower = factionPower;
  const wars = (f) => Object.keys(S.wars).filter((k) => k.split('|').includes(f)).map((k) => k.split('|').find((x) => x !== f));
  C.warsOf = wars;
  const alliesOf = (f) => Object.keys(S.allies).filter((k) => k.split('|').includes(f)).map((k) => k.split('|').find((x) => x !== f));
  C.alliesOf = alliesOf;
  C.isMajor = (f) => f !== 'minor' && S.factions[f].alive;

  C.provIncome = function (ps) {
    const d = C.def(ps.id);
    let v = d.income * INCOME_K * (1 + 0.5 * ps.market);
    if (ps.siege) v *= 0.1;
    v *= { tax: 1.25, levy: 0.85, order: 0.85 }[ps.policy] || 1;
    const u = ps.unrest || 0;
    v *= u >= 60 ? 0.5 : u >= 30 ? 0.8 : 1;
    return v;
  };
  C.factionIncome = function (f) {
    let v = 0;
    for (const p of C.provincesOf(f)) v += C.provIncome(S.provinces[p.id]);
    v += (COLONIAL[f] || 0) * INCOME_K * (S.factions[f].alive ? 1 : 0);
    const n = C.provincesOf(f).length;
    v *= 1 - clamp((n - 22) * 0.015, 0, 0.45); // overextension
    const dm = f === S.player ? { easy: 1.15, normal: 1, hard: 0.95 }[S.difficulty] : { easy: 0.88, normal: 1, hard: 1.1 }[S.difficulty];
    return Math.round(v * S.factions[f].incomeMult * (dm || 1));
  };
  C.factionUpkeep = (f) => C.armiesOf(f).reduce((s, a) => s + a.units.reduce((t, u) => t + U[u.type].upkeep, 0), 0);
  C.manpowerGain = function (f) {
    let v = 0;
    for (const p of C.provincesOf(f)) { const ps = S.provinces[p.id]; if (!ps.siege) v += C.def(p.id).manpower * MP_K * (1 + 0.5 * ps.barracks) * ({ levy: 1.5 }[ps.policy] || 1) * ((ps.unrest || 0) >= 60 ? 0.5 : 1); }
    return Math.round(v);
  };
  C.manpowerCap = (f) => 6000 + C.provincesOf(f).length * 500;

  // -------------------------------------------------------------------- movement graph
  function canEnter(f, pid) {
    const o = S.provinces[pid].owner;
    return o === f || allied(f, o) || atWar(f, o);
  }
  C.canEnter = canEnter;
  const isSea = (a, b) => W().byId[a].sea.includes(W().byId[b].idx);
  C.isSea = isSea;
  function nbrs(f, pid) {
    const p = W().byId[pid];
    const out = [];
    for (const i of p.adj) { const q = W().provs[i].id; if (canEnter(f, q)) out.push(q); }
    if (p.port) for (const i of p.sea) { const q = W().provs[i].id; if (canEnter(f, q)) out.push(q); }
    return out;
  }
  C.neighbors = nbrs;
  // BFS path (excluding start). maxDepth optional. Returns array of ids or null.
  function bfsPath(f, from, to, maxDepth, landOnly) {
    if (from === to) return [];
    const prev = { [from]: null }; let q = [from], d = 0;
    while (q.length && d < (maxDepth || 99)) {
      const nq = [];
      for (const cur of q) for (const n of nbrs(f, cur)) {
        if (n in prev || (landOnly && isSea(cur, n))) continue;
        prev[n] = cur;
        if (n === to) { const path = []; let c = to; while (c !== from) { path.unshift(c); c = prev[c]; } return path; }
        nq.push(n);
      }
      q = nq; d++;
    }
    return null;
  }
  // Prefer land routes; use the sea only when it is clearly faster
  C.findPath = function (f, from, to, maxDepth) {
    const land = bfsPath(f, from, to, maxDepth, true);
    const any = bfsPath(f, from, to, maxDepth, false);
    if (land && (!any || land.length <= any.length + 2)) return land;
    return any;
  };
  // Distances from a province to all reachable ones
  C.bfsAll = function (f, from, maxDepth) {
    const dist = { [from]: 0 }, prev = { [from]: null }; let q = [from], d = 0;
    while (q.length && d < maxDepth) {
      const nq = [];
      for (const cur of q) for (const n of nbrs(f, cur)) { if (n in dist) continue; dist[n] = d + 1; prev[n] = cur; nq.push(n); }
      q = nq; d++;
    }
    return { dist, prev };
  };
  C.orderMove = function (army, dest) {
    if (dest === army.prov) { army.path = []; return true; }
    const p = C.findPath(army.owner, army.prov, dest);
    if (!p) return false;
    let from = army.prov;
    for (const q of p) { if (isSea(from, q) && army.units.length > SEA_CAP) { C.lastError = `Too many regiments to sail (max ${SEA_CAP} per crossing) \u2014 split the army.`; return false; } from = q; }
    army.path = p;
    return true;
  };
  C.reachableNow = (army) => nbrs(army.owner, army.prov);

  // -------------------------------------------------------------------- armies ops
  C.splitArmy = function (army, idxs) {
    if (!idxs.length || idxs.length >= army.units.length) return null;
    const moved = [];
    idxs.sort((a, b) => b - a).forEach((i) => moved.push(army.units.splice(i, 1)[0]));
    const na = C.makeArmy(army.owner, army.prov, moved);
    na.from = army.from;
    return na;
  };
  C.mergeArmies = function (a, b) {
    if (a.owner !== b.owner || a.prov !== b.prov) return false;
    if (a.units.length + b.units.length > MAX_STACK) return false;
    a.units.push(...b.units);
    if (!a.general && b.general) { a.general = b.general; S.generals[b.general].assigned = a.id; b.general = null; }
    removeArmy(b);
    return true;
  };
  function removeArmy(a) {
    if (a.general) { const g = S.generals[a.general]; if (g) { g.assigned = null; if (g.alive) S.pool[g.owner].push(g.id); } a.general = null; }
    const i = S.armies.indexOf(a); if (i >= 0) S.armies.splice(i, 1);
  }
  C.disbandUnit = function (army, idx) {
    army.units.splice(idx, 1);
    if (!army.units.length) removeArmy(army);
  };
  C.stackLimit = MAX_STACK; C.seaCap = SEA_CAP;

  // -------------------------------------------------------------------- recruiting & building
  C.recruitCheck = function (pid, type) {
    const ps = S.provinces[pid], f = ps.owner, fs = S.factions[f], u = U[type];
    if (ps.siege) return 'Province is besieged';
    if (ps.queue.length >= 3) return 'Recruitment queue is full';
    if (u.needs && !ps[u.needs]) return 'Requires ' + NAP.BUILDINGS[u.needs].name;
    if (fs.gold < C.unitCost(pid, type)) return 'Not enough gold';
    if (fs.manpower < u.men) return 'Not enough manpower';
    if (S.armies.some((a) => a.prov === pid && atWar(a.owner, f))) return 'Enemy army present';
    return null;
  };
  C.recruit = function (pid, type) {
    const err = C.recruitCheck(pid, type);
    if (err) return err;
    const ps = S.provinces[pid], fs = S.factions[ps.owner], u = U[type];
    fs.gold -= C.unitCost(pid, type); fs.manpower -= u.men;
    ps.queue.push({ type, left: u.time, vet: ps.academy ? 1 : 0 });
    return null;
  };
  C.buildCheck = function (pid, b) {
    const ps = S.provinces[pid], fs = S.factions[ps.owner], bd = NAP.BUILDINGS[b];
    if (ps.build) return 'Already constructing';
    if (ps.siege) return 'Province is besieged';
    if (b === 'fort' ? ps.fort >= bd.max : ps[b] >= 1) return 'Already built';
    if (bd.req && !ps[bd.req]) return 'Requires ' + NAP.BUILDINGS[bd.req].name + ' first';
    if (fs.gold < bd.cost) return 'Not enough gold';
    return null;
  };
  C.build = function (pid, b) {
    const err = C.buildCheck(pid, b); if (err) return err;
    const ps = S.provinces[pid], bd = NAP.BUILDINGS[b];
    S.factions[ps.owner].gold -= bd.cost;
    ps.build = { type: b, left: bd.time };
    return null;
  };
  C.availableGenerals = (f) => S.pool[f].map((id) => S.generals[id]).filter((g) => g.alive);

  // -------------------------------------------------------------------- diplomacy
  function joinWars(a, b, depth) {
    // allies of the defender may join; allies of the aggressor may join
    for (const x of alliesOf(b)) if (x !== a && x !== S.player && !atWar(x, a) && !allied(x, a) && S.factions[x].alive) {
      if (rnd() < 0.7) { declareWar(x, a, depth + 1, `honours the alliance with ${F(b).name}`); }
    }
    for (const x of alliesOf(a)) if (x !== b && x !== S.player && !atWar(x, b) && !allied(x, b) && S.factions[x].alive && x !== 'minor') {
      if (rnd() < 0.5 * (0.5 + F(x).aggr)) declareWar(x, b, depth + 1, `stands with ${F(a).name}`);
    }
  }
  function declareWar(a, b, depth, why) {
    if (atWar(a, b) || a === b || !S.factions[a].alive || !S.factions[b].alive) return false;
    if (allied(a, b)) delete S.allies[pkey(a, b)];
    S.wars[pkey(a, b)] = { since: S.turn, exh: 0, s: {} };
    addRel(a, b, -40);
    plog(`${F(a).name} declares war on ${F(b).name}${why ? ' (' + why + ')' : ''}!`, 'war', [a, b]);
    if (a !== S.player && b !== S.player) C.log(`${F(a).name} declares war on ${F(b).name}.`, 'war-minor');
    if (!depth || depth < 2) joinWars(a, b, depth || 0);
    // clear armies of former allies from foreign soil: they simply become hostile
    return true;
  }
  C.declareWar = (a, b, why) => declareWar(a, b, 0, why);
  function makePeace(a, b) {
    if (!atWar(a, b)) return;
    delete S.wars[pkey(a, b)];
    (S.truce = S.truce || {})[pkey(a, b)] = S.turn + 12;
    addRel(a, b, 20);
    for (const p of Object.values(S.provinces)) if (p.siege && (p.siege.by === a || p.siege.by === b) && !atWar(p.siege.by, p.owner)) p.siege = null;
    plog(`${F(a).name} and ${F(b).name} sign a peace treaty.`, 'peace', [a, b]);
    if (a !== S.player && b !== S.player) C.log(`${F(a).name} and ${F(b).name} make peace.`, 'peace-minor');
    expelFromTerritory();
  }
  C.makePeace = makePeace;
  function makeAlliance(a, b) {
    S.allies[pkey(a, b)] = true; addRel(a, b, 20);
    plog(`${F(a).name} and ${F(b).name} form an alliance.`, 'alliance', [a, b]);
    if (a !== S.player && b !== S.player) C.log(`${F(a).name} and ${F(b).name} become allies.`, 'alliance-minor');
  }
  C.makeAlliance = makeAlliance;
  C.breakAlliance = function (a, b) { delete S.allies[pkey(a, b)]; addRel(a, b, -25); plog(`${F(a).name} breaks its alliance with ${F(b).name}.`, 'diplomacy', [a, b]); };
  // After peace, armies standing in provinces they can no longer occupy are pushed back
  function expelFromTerritory() {
    // armies standing where they are no longer welcome are pushed back to friendly soil
    for (const a of S.armies.slice()) {
      if (canEnter(a.owner, a.prov)) continue;
      const ps = S.provinces[a.prov];
      const opts = nbrs(a.owner, a.prov).filter((q) => S.provinces[q].owner === a.owner);
      let dest = opts[0];
      if (!dest) {
        const bf = C.bfsAll(a.owner, a.prov, 6).dist;
        const own = Object.keys(bf).filter((id) => S.provinces[id].owner === a.owner).sort((x, y) => bf[x] - bf[y]);
        dest = own[0];
      }
      if (dest) { a.prov = dest; a.path = []; a.from = dest; plog(`${F(a.owner).adj} forces withdraw from ${C.def(ps.id).name}.`, 'info', [a.owner]); } else removeArmy(a);
      if (ps.siege && ps.siege.by === a.owner) ps.siege = null;
    }
  }
  // Does an AI faction accept peace? Returns [bool, reason]
  C.acceptsPeace = function (ai, other) {
    const w = S.wars[pkey(ai, other)];
    if (!w) return [false, 'You are not at war.'];
    if (S.turn - w.since < 2) return [false, 'The war has only just begun.'];
    const mine = factionPower(ai) + 1, theirs = factionPower(other) + 1;
    const sr = mine / theirs;
    let score = w.exh * 5 - F(ai).aggr * 18;
    const lost = C.provincesOf(other).filter((p) => p.owner === ai).length; // originally ai's now other's
    score += lost * 12;
    if (sr < 0.8) score += (0.8 - sr) * 60;
    if (sr > 1.4) score -= 25;
    if (S.factions[ai].gold < 0) score += 10;
    if (other === S.player) score += S.difficulty === 'easy' ? 10 : S.difficulty === 'hard' ? -8 : 0;
    const heldFromOther = C.provincesOf(ai).filter((p) => p.owner === other).length;
    score -= heldFromOther * 12;
    if (S.provinces[S.factions[ai].cap] && S.provinces[S.factions[ai].cap].owner !== ai) score += 20;
    const ok = score >= 25;
    return [ok, ok ? 'Peace is accepted.' : sr > 1.2 ? 'They believe they are winning and refuse.' : 'They are not ready for peace yet.'];
  };
  C.acceptsAlliance = function (ai, other) {
    if (ai === 'minor' || other === 'minor') return [false, 'They have no interest.'];
    if (atWar(ai, other)) return [false, 'You are at war.'];
    const r = C.rel(ai, other);
    const common = wars(ai).filter((x) => atWar(other, x)).length;
    const score = r + common * 25;
    const ok = score >= 35 && !wars(ai).includes(other);
    return [ok, ok ? 'They agree to an alliance.' : r < 15 ? 'Relations are too poor.' : 'They see no need for an alliance.'];
  };


  // -------------------------------------------------------------------- war score & peace terms
  function addScore(winner, loser, pts) {
    const w = S.wars[pkey(winner, loser)];
    if (w) { w.s = w.s || {}; w.s[winner] = (w.s[winner] || 0) + pts; }
  }
  C.warScore = function (a, b) { const w = S.wars[pkey(a, b)]; return w && w.s ? (w.s[a] || 0) - (w.s[b] || 0) : 0; };
  const provValue = (pid) => { const d = C.def(pid); return 12 + d.income * 1.5 + (d.capital ? 25 : 0) + S.provinces[pid].fort * 4; };
  // Options for the player ('from') when negotiating with 'to'
  C.peaceOptions = function (from, to) {
    const opts = [{ id: 'status', label: 'White peace (status quo)' }];
    const gTo = Math.max(0, Math.floor(S.factions[to].gold)), gFrom = Math.max(0, Math.floor(S.factions[from].gold));
    if (gTo >= 100) opts.push({ id: 'gold', label: `Demand ${Math.min(300, gTo)} gold`, gold: Math.min(300, gTo) });
    for (const p of W().provs) {
      const ps = S.provinces[p.id];
      if (ps.owner !== to) continue;
      if (S.armies.some((a) => a.prov === p.id && a.owner === from) || (ps.siege && ps.siege.by === from)) opts.push({ id: 'province:' + p.id, label: `Demand ${p.name} (occupied)` });
    }
    if (gFrom >= 100) opts.push({ id: 'tribute', label: `Pay ${Math.min(250, gFrom)} gold tribute`, gold: Math.min(250, gFrom) });
    for (const p of W().provs) {
      const ps = S.provinces[p.id];
      if (ps.owner === from && p.owner === to) opts.push({ id: 'release:' + p.id, label: `Return ${p.name}` });
    }
    return opts;
  };
  // Player proposes peace to an AI faction with a chosen term. Returns [ok, message].
  C.proposePeace = function (from, to, termId) {
    const w = S.wars[pkey(from, to)];
    if (!w) return [false, 'You are not at war.'];
    const [base] = C.acceptsPeace(to, from);
    let [, why] = C.acceptsPeace(to, from);
    // recompute numeric score
    const mine = factionPower(to) + 1, theirs = factionPower(from) + 1, sr = mine / theirs;
    let score = w.exh * 5 - F(to).aggr * 18;
    score += C.provincesOf(from).filter((p) => p.owner === to).length * 12;
    if (sr < 0.8) score += (0.8 - sr) * 60;
    if (sr > 1.4) score -= 25;
    score -= C.provincesOf(to).filter((p) => p.owner === from).length * 12;
    score += C.warScore(from, to) * 0.4;
    if (S.factions[to].gold < 0) score += 10;
    const sp = S.provinces[S.factions[to].cap];
    if (sp && sp.owner !== to) score += 20;
    if (from === S.player) score += S.difficulty === 'easy' ? 10 : S.difficulty === 'hard' ? -8 : 0;
    const [kind, arg] = termId.split(':');
    let apply = () => {};
    const optList = C.peaceOptions(from, to);
    const opt = optList.find((o) => o.id === termId);
    if (!opt) return [false, 'That term is no longer available.'];
    if (kind === 'gold') { score -= opt.gold / 25; apply = () => { S.factions[to].gold -= opt.gold; S.factions[from].gold += opt.gold; }; }
    else if (kind === 'province') { score -= provValue(arg) * 1.1; apply = () => { const ps = S.provinces[arg]; ps.owner = from; ps.siege = null; ps.queue = []; ps.build = null; ps.unrest = 35; NAP.recolor(S); if (!C.provincesOf(to).length) eliminate(to); }; }
    else if (kind === 'tribute') { score += opt.gold / 20; apply = () => { S.factions[from].gold -= opt.gold; S.factions[to].gold += opt.gold; }; }
    else if (kind === 'release') { score += provValue(arg) * 0.9; apply = () => { const ps = S.provinces[arg]; ps.owner = to; ps.siege = null; ps.unrest = 10; NAP.recolor(S); }; }
    if (S.turn - w.since < 2) return [false, 'The war has only just begun.'];
    const ok = score >= 25;
    if (ok) { apply(); makePeace(from, to); return [true, 'Peace is agreed on your terms.']; }
    return [false, kind === 'province' || kind === 'gold' ? 'Those demands are too harsh for them.' : 'They are not ready for peace yet.'];
  };

  // -------------------------------------------------------------------- province policy, unrest, assault
  C.setPolicy = function (pid, pol) { const ps = S.provinces[pid]; if (ps) ps.policy = pol; };
  function unrestPhase() {
    if ((S.year > 1812 || (S.year === 1812 && S.month >= 6)) && S.factions.france.incomeMult > 1) S.factions.france.incomeMult = 1;
    for (const p of W().provs) {
      const ps = S.provinces[p.id]; if (ps.owner === 'minor' && !p.owner) continue;
      const core = p.owner === ps.owner;
      let d = core ? -2 : 2.5;
      if (!core && (p.owner === 'spain' || p.owner === 'portugal' || p.owner === 'russia' || p.terrain === 'm') && !allied(ps.owner, p.owner)) d += 2;
      d += { tax: 2, levy: 1, order: -4 }[ps.policy] || 0;
      const gar = S.armies.filter((a) => a.prov === p.id && (a.owner === ps.owner)).reduce((n, a) => n + a.units.length, 0);
      if (gar) d -= gar >= 3 ? 8 : 5;
      const before = ps.unrest || 0;
      ps.unrest = clamp(before + d, 0, 100);
      if (before < 60 && ps.unrest >= 60) plog(`Unrest is rising in ${p.name}!`, 'bad', [ps.owner]);
      if (ps.unrest >= 100) revolt(p, ps);
    }
  }
  function revolt(p, ps) {
    const was = ps.owner, back = !core(p, ps) && S.factions[p.owner] && p.owner !== 'minor' ? p.owner : 'minor';
    ps.owner = back; ps.unrest = 30; ps.siege = null; ps.queue = []; ps.build = null; ps.policy = 'balanced';
    if (back !== 'minor' && !S.factions[back].alive) { S.factions[back].alive = true; if (!S.factions[back].cap) S.factions[back].cap = p.id; }
    for (const a of S.armies.filter((x) => x.prov === p.id && x.owner === was && !canEnter(x.owner, p.id))) { a.path = []; }
    const a = C.makeArmy(back, p.id, parseSpec('line:2 hussar:1'));
    plog(`${p.name} rises in revolt against ${F(was).name}!${back === 'minor' ? '' : ' ' + F(back).adj + ' loyalists take control.'}`, was === S.player ? 'bad' : 'war', [was, back]);
    if (was !== S.player && back !== S.player) C.log(`${p.name} revolts against ${F(was).adj} rule.`, 'capture-minor');
    NAP.recolor(S);
  }
  function core(p, ps) { return p.owner === ps.owner; }
  // Storm a fortified province: returns {ok, text}
  C.assaultCheck = function (army) {
    const ps = S.provinces[army.prov];
    if (!atWar(army.owner, ps.owner)) return 'This province is not hostile.';
    if (S.armies.some((a) => a.prov === army.prov && atWar(a.owner, army.owner))) return 'Enemy army present.';
    if (ps.fort < 1) return 'Unfortified: the siege will fall on its own.';
    if (army.assaulted === S.turn) return 'Already stormed this turn.';
    return null;
  };
  C.assault = function (army) {
    const err = C.assaultCheck(army); if (err) return { ok: false, text: err };
    const ps = S.provinces[army.prov], d = C.def(army.prov);
    const garrison = (500 + 450 * ps.fort) * (1 + 0.25 * ps.fort) * (TERRAIN_DEF[d.terrain] || 1);
    const arty = army.units.filter((u) => u.type === 'art').length;
    const att = C.armyPower(army) * (1 + Math.min(0.6, arty * 0.12)) * (1 - (army.fatigue || 0) / 250) * F(army.owner).morale;
    const r = (att / garrison) * (0.85 + rnd() * 0.3);
    army.assaulted = S.turn;
    if (r > 1) {
      applyCasualties([army], clamp(0.05 + 0.07 * ps.fort / r, 0.04, 0.35));
      army.units = army.units.filter((u) => u.men > 0);
      plog(`${F(army.owner).adj} troops storm the walls of ${d.name}!`, army.owner === S.player ? 'good' : 'bad', [army.owner, ps.owner]);
      addScore(army.owner, ps.owner, 6);
      captureProvince(army.prov, army.owner);
      return { ok: true, text: `${d.name} stormed and captured!` };
    }
    applyCasualties([army], clamp(0.12 + 0.07 * ps.fort, 0.1, 0.45));
    plog(`The assault on ${d.name} is repulsed with heavy losses.`, 'bad', [army.owner, ps.owner]);
    if (!army.units.length) removeArmy(army);
    return { ok: false, text: 'The assault failed with heavy losses.' };
  };
  C.garrisonStrength = (pid) => { const ps = S.provinces[pid]; return Math.round((500 + 450 * ps.fort) * (1 + 0.25 * ps.fort)); };

  // -------------------------------------------------------------------- battles
  const TERRAIN_DEF = { p: 1.0, h: 1.15, f: 1.1, m: 1.25 };
  function genBonus(armies) {
    let best = null;
    for (const a of armies) if (a.general) { const g = S.generals[a.general]; if (!best || g.lead + g.atk > best.lead + best.atk) best = g; }
    return best;
  }
  function sidePower(armies, extraMul) {
    let p = 0;
    for (const a of armies) for (const u of a.units) p += u.men * U[u.type].power * (1 + 0.06 * C.vetOf(u)) * F(a.owner).morale * (C.provincesOf(a.owner).length <= 4 && a.owner !== 'minor' ? 1.15 : 1) * (1 - (a.fatigue || 0) / 250); // last stand, tiredness
    const g = genBonus(armies);
    return p * (1 + (g ? (g.atk + g.def + g.lead - 9) * 0.03 : 0)) * (extraMul || 1);
  }
  function applyCasualties(armies, frac) {
    for (const a of armies) {
      for (const u of a.units) {
        const f = clamp(frac * (0.8 + rnd() * 0.4), 0, 0.97);
        u.men = Math.round(u.men * (1 - f));
      }
      a.units = a.units.filter((u) => u.men >= Math.max(15, u.max * 0.08));
    }
  }
  function award(armies, victory) {
    for (const a of armies) {
      if (victory) for (const u of a.units) u.xp = (u.xp || 0) + 1;
      if (!a.general) continue;
      const g = S.generals[a.general];
      g.xp += victory ? 30 : 10;
      const need = [0, 40, 100, 200, 350, 550, 800][g.lvl] || 9999;
      if (g.xp >= need && g.lvl < 7) {
        g.lvl++;
        const stat = ['atk', 'def', 'lead'][Math.floor(rnd() * 3)];
        if (g[stat] < 7) g[stat]++;
        plog(`${g.name} is promoted to level ${g.lvl}!`, 'good', [g.owner]);
      }
    }
  }
  function killGeneral(a, fromBattle) {
    if (!a.general) return;
    const g = S.generals[a.general];
    g.alive = false; g.assigned = null; a.general = null;
    plog(`${g.name} has been killed in action!`, 'bad', [g.owner]);
  }
  function retreat(a, fromProv, enemyFacs) {
    // Retreat to the province we came from if safe, else own territory, else anywhere safe
    const bad = (q) => S.armies.some((x) => x.prov === q && enemyFacs.includes(x.owner));
    a.path = [];
    const cands = nbrs(a.owner, a.prov).filter((q) => !bad(q) && !isSea(a.prov, q));
    let dest = null;
    if (fromProv && fromProv === a.prov) return true; // attacker repulsed: stays where it started
    if (fromProv && cands.includes(fromProv)) dest = fromProv;
    if (!dest) dest = cands.find((q) => S.provinces[q].owner === a.owner) || cands[0] || null;
    if (!dest) { removeArmy(a); return false; }
    a.prov = dest; a.from = dest;
    return true;
  }

  function pickWeather() {
    const r = rnd(), winter = S.month === 12 || S.month <= 2;
    if (winter) return r < 0.4 ? 'snow' : r < 0.55 ? 'fog' : r < 0.65 ? 'rain' : 'clear';
    return r < 0.62 ? 'clear' : r < 0.82 ? 'rain' : 'fog';
  }
  function pickTod() { const r = rnd(); return r < 0.2 ? 'dawn' : r < 0.8 ? 'day' : 'dusk'; }

  async function resolveBattle(attacker, prov, from) {
    const ps = S.provinces[prov];
    const here = S.armies.filter((x) => x.prov === prov && x !== attacker);
    const defs = here.filter((x) => atWar(x.owner, attacker.owner));
    const friends = here.filter((x) => x.owner === attacker.owner || allied(x.owner, attacker.owner));
    const sideA = [attacker, ...friends], sideD = defs;
    const facsA = [...new Set(sideA.map((a) => a.owner))], facsD = [...new Set(sideD.map((a) => a.owner))];
    const playerA = facsA.includes(S.player), playerD = facsD.includes(S.player);
    // Fort/terrain bonuses
    const fortOwner = ps.owner;
    const fortSideIsA = facsA.some((f) => f === fortOwner || allied(f, fortOwner));
    const fortSideIsD = facsD.some((f) => f === fortOwner || allied(f, fortOwner));
    const terr = C.def(prov).terrain;
    let result = null;
    const involved = playerA || playerD;
    let choice = 'auto';
    if (involved && H().runBattle) {
      S.pendingWeather = pickWeather(); S.pendingTod = pickTod();
      choice = await H().askBattle({ weather: S.pendingWeather, tod: S.pendingTod, prov, sideA, sideD, attackerSide: 0, playerIsAttacker: playerA, terrain: terr, fort: ps.fort, fortSide: fortSideIsD ? 'D' : fortSideIsA ? 'A' : null });
    }
    let winner; // 'A' | 'D'
    let fieldCasualtiesApplied = false;
    if (choice === 'fight') {
      const pSide = playerA ? sideA : sideD, eSide = playerA ? sideD : sideA;
      const spec = {
        terrain: terr, provName: C.def(prov).name, weather: S.pendingWeather || 'clear', tod: S.pendingTod || 'day', month: S.month,
        playerIsAttacker: playerA,
        fort: ps.fort,
        fortSide: (playerA ? fortSideIsA : fortSideIsD) ? 0 : ((playerA ? fortSideIsD : fortSideIsA) ? 1 : -1),
        sides: [mkSide(pSide), mkSide(eSide)]
      };
      result = await H().runBattle(spec);
      if (result) {
        const pw = result.winner === 0;
        winner = (pw && playerA) || (!pw && !playerA) ? 'A' : 'D';
        for (const id of result.deadGenerals || []) {
          [...sideA, ...sideD].forEach((a) => { if (a.general === id) killGeneral(a, true); });
        }
        fieldCasualtiesApplied = true;
        // clean up empty units (battle mutated unit.men directly)
        [...sideA, ...sideD].forEach((a) => { a.units = a.units.filter((u) => u.men >= Math.max(15, u.max * 0.05)); });
      }
    }
    if (!fieldCasualtiesApplied) {
      const rA = sidePower(sideA, fortSideIsA ? 1 + 0.12 * ps.fort : 1) * (0.85 + rnd() * 0.3);
      const rD = sidePower(sideD, (TERRAIN_DEF[terr] || 1) * (fortSideIsD ? 1 + 0.12 * ps.fort : 1)) * (0.85 + rnd() * 0.3);
      winner = rA > rD ? 'A' : 'D';
      const k = Math.min(rA, rD) / Math.max(rA, rD, 1);
      const winLoss = 0.07 + 0.22 * k, loseLoss = 0.32 + 0.45 * (1 - k);
      applyCasualties(winner === 'A' ? sideA : sideD, winLoss);
      applyCasualties(winner === 'A' ? sideD : sideA, loseLoss);
      for (const a of winner === 'A' ? sideD : sideA) if (a.general && rnd() < 0.12) killGeneral(a);
    }
    const win = winner === 'A' ? sideA : sideD, lose = winner === 'A' ? sideD : sideA;
    const loseFacs = winner === 'A' ? facsD : facsA, winFacs = winner === 'A' ? facsA : facsD;
    award(win, true); award(lose, false);
    for (const f of winFacs) S.factions[f].wonBattles++;
    for (const f of loseFacs) S.factions[f].lostBattles++;
    for (const f of winFacs) for (const e of loseFacs) addScore(f, e, 5);
    const name = C.def(prov).name;
    const lead = (arr) => F(arr[0].owner).adj;
    plog(`Battle of ${name}: ${F(win[0].owner).name} defeats ${F(lose[0].owner).name}${choice === 'fight' ? '' : ' (auto-resolved)'}.`,
      win.some((a) => a.owner === S.player) ? 'good' : 'bad', [...facsA, ...facsD]);
    if (!involved) C.log(`Battle of ${name}: ${F(win[0].owner).adj} victory over the ${F(lose[0].owner).adj}.`, 'battle-minor');
    // retreat losers
    const enemyFacs = winFacs;
    for (const a of lose.slice()) {
      if (!a.units.length) { removeArmy(a); continue; }
      const origin = a === attacker ? from : null;
      retreat(a, origin, enemyFacs);
    }
    // empty winners
    for (const a of win.slice()) if (!a.units.length) removeArmy(a);
    if (winner === 'A' && S.armies.includes(attacker)) { attacker.prov = prov; attacker.path = attacker.path.filter((x) => x !== prov); }
    if (winner === 'D' && S.armies.includes(attacker)) { /* already retreated */ }
    return winner;
  }
  function mkSide(armies) {
    const units = [];
    armies.forEach((a) => a.units.forEach((u) => units.push({ ref: u, type: u.type, men: u.men, max: u.max, faction: a.owner, vet: C.vetOf(u), fatigue: Math.min(60, (a.fatigue || 0) * 0.7) })));
    const g = genBonus(armies);
    return {
      faction: armies[0].owner, armies, units,
      general: g ? { id: g.id, name: g.name, atk: g.atk, def: g.def, lead: g.lead, trait: g.trait } : null
    };
  }

  // -------------------------------------------------------------------- turn processing
  async function stepArmy(a, second) {
    if (!S.armies.includes(a) || !a.path.length) return;
    a.moved = true;
    const dest = a.path[0];
    if (!canEnter(a.owner, dest) || !nbrs(a.owner, a.prov).includes(dest)) { a.path = []; return; }
    const from = a.prov;
    const sea = isSea(from, dest);
    a.path.shift();
    a.from = from;
    if (sea && a.units.length > SEA_CAP) { plog(`The ${F(a.owner).adj} army is too large to sail (max ${SEA_CAP} regiments).`, 'bad', [a.owner]); a.path = []; a.from = from; return; }
    const enemies = S.armies.filter((x) => x.prov === dest && atWar(x.owner, a.owner));
    if (enemies.length) {
      const prevProv = a.prov;
      await resolveBattle(a, dest, from);
      return;
    }
    a.prov = dest;
    if (S.provinces[dest].siege && S.provinces[dest].siege.by !== a.owner && atWar(S.provinces[dest].siege.by, a.owner)) {
      // relief army breaks siege
      S.provinces[dest].siege = null;
    }
    if (a.forced && !second && a.path.length && S.armies.includes(a)) {
      const nxt = a.path[0];
      if (!S.armies.some((x) => x.prov === nxt && atWar(x.owner, a.owner)) && S.provinces[dest].owner !== 'x') {
        applyCasualties([a], 0.03); a.forcedMarch = true;
        await stepArmy(a, true);
      }
    }
  }

  function siegePhase(f) {
    for (const p of W().provs) {
      const ps = S.provinces[p.id];
      const mine = S.armies.filter((a) => a.prov === p.id && a.owner === f);
      if (!mine.length) continue;
      if (!atWar(f, ps.owner)) continue;
      if (S.armies.some((a) => a.prov === p.id && atWar(a.owner, f))) continue; // contested
      const arty = mine.reduce((s, a) => s + a.units.filter((u) => u.type === 'art').length, 0);
      const power = (arty >= 2 ? 2 : 1) + (arty >= 5 ? 1 : 0);
      if (!ps.siege || ps.siege.by !== f) ps.siege = { by: f, progress: power };
      else ps.siege.progress += power;
      if (ps.siege.progress > ps.fort) captureProvince(p.id, f);
      else plog(`${F(f).adj} forces besiege ${p.name} (${ps.siege.progress}/${ps.fort + 1}).`, 'info', [f, ps.owner]);
    }
    // clear sieges with no besieger
    for (const p of W().provs) {
      const ps = S.provinces[p.id];
      if (ps.siege && !S.armies.some((a) => a.prov === p.id && a.owner === ps.siege.by)) ps.siege = null;
    }
  }

  function captureProvince(pid, f) {
    const ps = S.provinces[pid], old = ps.owner, d = C.def(pid);
    ps.owner = f; ps.siege = null; ps.queue = []; ps.build = null; ps.policy = 'balanced';
    ps.unrest = d.owner === f ? 10 : 35;
    addScore(f, old, 10 + Math.round(d.income) + (d.capital ? 25 : 0));
    for (const b of ['market', 'barracks', 'stables', 'arsenal', 'academy']) if (rnd() < 0.45) ps[b] = 0;
    if (!ps.barracks) ps.academy = 0;
    plog(`${F(f).name} captures ${d.name} from ${F(old).name}!`, f === S.player ? 'good' : 'bad', [f, old]);
    if (f !== S.player && old !== S.player) C.log(`${d.name} falls to ${F(f).adj} forces.`, 'capture-minor');
    if (S.factions[old].cap === pid && old !== 'minor') {
      const loot = Math.round(Math.max(0, S.factions[old].gold) * 0.25);
      S.factions[old].gold -= loot; S.factions[f].gold += loot;
      plog(`The capital of ${F(old).name} has fallen! ${loot} gold is looted.`, f === S.player ? 'good' : 'bad', [f, old]);
    }
    if (!C.provincesOf(old).length) eliminate(old);
    NAP.recolor(S);
  }
  function eliminate(f) {
    const fs = S.factions[f];
    if (!fs.alive) return;
    fs.alive = false;
    plog(`${F(f).name} has been eliminated!`, f === S.player ? 'bad' : 'war', null);
    for (const a of S.armies.filter((x) => x.owner === f)) removeArmy(a);
    for (const k of Object.keys(S.wars)) if (k.split('|').includes(f)) delete S.wars[k];
    for (const k of Object.keys(S.allies)) if (k.split('|').includes(f)) delete S.allies[k];
  }

  // distance (in provinces) from friendly soil; 0 = at home
  function supplyDepth(a) {
    const home = (id) => { const o = S.provinces[id].owner; return o === a.owner || allied(a.owner, o); };
    if (home(a.prov)) return 0;
    let q = [a.prov], seen = new Set(q), d = 0;
    while (q.length && d < 4) {
      d++; const nq = [];
      for (const cur of q) for (const i of W().byId[cur].adj) {
        const id = W().provs[i].id; if (seen.has(id)) continue; seen.add(id);
        if (home(id)) return d; nq.push(id);
      }
      q = nq;
    }
    return 4;
  }
  C.supplyDepth = supplyDepth;
  function attrition() {
    const month = S.month;
    for (const a of S.armies.slice()) {
      const ps = S.provinces[a.prov], d = C.def(a.prov);
      let loss = 0;
      const home = ps.owner === a.owner || allied(a.owner, ps.owner);
      const depth = supplyDepth(a); a.supply = depth;
      if (!home) loss += 0.012 * (1 + a.units.length / 12) * (depth <= 1 ? 1.5 : depth === 2 ? 2.2 : 3.2);
      if (!home && d.terrain === 'm') loss += 0.01;
      if ((month === 12 || month <= 2) && d.owner === 'russia' && a.owner !== 'russia' && !allied(a.owner, 'russia')) loss += 0.10;
      // marching fatigue
      if (a.moved) a.fatigue = Math.min(100, (a.fatigue || 0) + (a.forcedMarch ? 38 : 7)); else a.fatigue = Math.max(0, (a.fatigue || 0) - 25);
      a.moved = false; a.forcedMarch = false;
      if (loss > 0) {
        applyCasualties([a], loss);
        if (!a.units.length) { plog(`The ${F(a.owner).adj} army in ${d.name} has melted away from attrition!`, 'bad', [a.owner]); removeArmy(a); }
        else if (loss > 0.08) plog(`Hardship ravages the ${F(a.owner).adj} army in ${d.name}.`, 'bad', [a.owner]);
      } else if (home && !a.path.length) {
        const fs = S.factions[a.owner];
        for (const u of a.units) {
          if (u.men < u.max && fs.manpower > 0) {
            const add = Math.min(u.max - u.men, Math.round(u.max * 0.15), fs.manpower);
            u.men += add; fs.manpower -= add;
          }
        }
      }
    }
  }

  function subsidies() {
    const g = S.factions.britain;
    if (!g || !g.alive || g.gold < 500) return;
    for (const x of alliesOf('britain')) {
      if (!S.factions[x].alive || !wars(x).length || g.gold < 450) continue;
      g.gold -= 70; S.factions[x].gold += 70;
      plog(`British subsidies of 70 gold reach ${F(x).name}.`, 'good', [x, 'britain']);
    }
  }

  function economyPhase() {
    unrestPhase();
    S.report = {};
    for (const id in S.factions) {
      const fs = S.factions[id]; if (!fs.alive) continue;
      const inc = C.factionIncome(id), up = C.factionUpkeep(id);
      fs.gold += inc - up;
      fs.manpower = Math.min(C.manpowerCap(id), fs.manpower + C.manpowerGain(id));
      if (fs.gold < -300) fs.gold = -300;
      if (fs.gold < 0) {
        const armies = C.armiesOf(id);
        let lost = 0;
        for (const a of armies) {
          for (let i = a.units.length - 1; i >= 0; i--) if (rnd() < 0.12) { a.units.splice(i, 1); lost++; }
          if (!a.units.length) removeArmy(a);
        }
        if (lost) plog(`${F(id).name} cannot pay its troops! ${lost} regiments desert.`, 'bad', [id]);
      }
      S.report[id] = { income: inc, upkeep: up };
    }
    subsidies();
    // build queues
    for (const p of W().provs) {
      const ps = S.provinces[p.id];
      if (ps.siege) continue;
      if (ps.build) {
        ps.build.left--;
        if (ps.build.left <= 0) {
          if (ps.build.type === 'fort') ps.fort++; else ps[ps.build.type] = 1;
          plog(`${NAP.BUILDINGS[ps.build.type].name} completed in ${p.name}.`, 'good', [ps.owner]);
          ps.build = null;
        }
      }
      if (ps.queue.length) {
        for (const q of ps.queue) q.left--;
        const done = ps.queue.filter((q) => q.left <= 0);
        ps.queue = ps.queue.filter((q) => q.left > 0);
        if (done.length) {
          const units = done.map((q) => C.newUnit(q.type, q.vet));
          let host = S.armies.find((a) => a.prov === p.id && a.owner === ps.owner && !a.path.length && a.units.length + units.length <= MAX_STACK);
          if (host) host.units.push(...units); else C.makeArmy(ps.owner, p.id, units);
          plog(`${units.length} new regiment(s) raised in ${p.name}.`, 'good', [ps.owner]);
        }
      }
    }
  }

  // -------------------------------------------------------------------- AI
  const WANT = { line: 0.38, light: 0.12, grenadier: 0.07, guard: 0.03, hussar: 0.08, lancer: 0.04, cuirass: 0.07, art: 0.15, hart: 0.03 };
  function threatDist(f, pid, enemies) {
    // Distance from province to nearest enemy-owned province
    const r = C.bfsAll(f, pid, 5).dist;
    let best = 9;
    for (const id in r) if (enemies.includes(S.provinces[id].owner)) best = Math.min(best, r[id]);
    return best;
  }

  function aiRecruit(f) {
    const fs = S.factions[f];
    const en = wars(f);
    const income = C.factionIncome(f);
    let up = C.factionUpkeep(f);
    const own = C.provincesOf(f).filter((p) => !S.provinces[p.id].siege && !S.armies.some((a) => a.prov === p.id && atWar(a.owner, f)));
    if (!own.length) return;
    const counts = {}; let total = 0;
    for (const a of C.armiesOf(f)) for (const u of a.units) { counts[u.type] = (counts[u.type] || 0) + 1; total++; }
    for (const p of own) for (const q of S.provinces[p.id].queue) { counts[q.type] = (counts[q.type] || 0) + 1; total++; }
    const diffMul = S.difficulty === 'hard' ? 1.15 : S.difficulty === 'easy' ? 0.85 : 1;
    const budgetUp = income * (en.length ? (C.provincesOf(f).length <= 4 ? 0.92 : 0.78) : 0.5) * diffMul;
    let guard = 0;
    while (guard++ < 5) {
      if (up >= budgetUp) break;
      if (fs.gold < 100 + (en.length ? 0 : 150)) break;
      // pick type with greatest deficit
      let best = null, bd = -9;
      for (const t in WANT) {
        if (U[t].needs && !own.some((p) => S.provinces[p.id][U[t].needs])) continue;
        const def = WANT[t] - (counts[t] || 0) / Math.max(1, total);
        if (def > bd && fs.gold >= U[t].cost && fs.manpower >= U[t].men) { bd = def; best = t; }
      }
      if (!best) break;
      // choose province: closest to enemy (or capital when peaceful)
      const cands = own.filter((p) => S.provinces[p.id].queue.length < 3 && (!U[best].needs || S.provinces[p.id][U[best].needs]));
      if (!cands.length) break;
      let pick;
      if (en.length) {
        cands.sort((a, b) => threatDist(f, a.id, en) - threatDist(f, b.id, en) || C.def(b.id).manpower - C.def(a.id).manpower);
        pick = cands[Math.min(cands.length - 1, Math.floor(rnd() * Math.min(3, cands.length)))];
      } else pick = cands[Math.floor(rnd() * cands.length)];
      if (C.recruit(pick.id, best)) break;
      counts[best] = (counts[best] || 0) + 1; total++; up += U[best].upkeep;
    }
    for (const p of own) { const ps = S.provinces[p.id]; ps.policy = (ps.unrest || 0) > 35 ? 'order' : fs.gold < 120 ? 'tax' : 'balanced'; }
    // buildings
    if (fs.gold > 450 && rnd() < 0.25) {
      const cands = own.filter((p) => !S.provinces[p.id].build);
      const pick = cands[Math.floor(rnd() * cands.length)];
      if (pick) {
        const ps = S.provinces[pick.id];
        const opts = [];
        if (!ps.market && C.def(pick.id).income >= 4) opts.push('market');
        if (!ps.barracks && C.def(pick.id).manpower >= 3) opts.push('barracks');
        if (!ps.stables && C.def(pick.id).income >= 3 && fs.gold > 500) opts.push('stables');
        if (!ps.arsenal && C.def(pick.id).income >= 4 && fs.gold > 550) opts.push('arsenal');
        if (ps.barracks && !ps.academy && fs.gold > 800) opts.push('academy');
        if (ps.fort < 2 && en.length && threatDist(f, pick.id, en) <= 2) opts.push('fort');
        if (opts.length) C.build(pick.id, opts[Math.floor(rnd() * opts.length)]);
      }
    }
  }

  function aiGenerals(f) {
    for (const a of C.armiesOf(f)) {
      if (a.general) continue;
      const pool = C.availableGenerals(f);
      if (!pool.length) break;
      if (a.units.length < 3) continue;
      pool.sort((x, y) => y.atk + y.def + y.lead - (x.atk + x.def + x.lead));
      C.assignGeneral(a, pool[0].id);
    }
  }

  function aiDiplomacy(f) {
    if (f === 'minor' || (f === S.player && !S.autoplay)) return;
    const aggr = F(f).aggr;
    // peace
    for (const e of wars(f)) {
      const w = S.wars[pkey(f, e)];
      w.exh++;
      const [ok] = C.acceptsPeace(f, e);
      const wantsPeace = (ok && rnd() < 0.35) || w.exh >= 16;
      if (wantsPeace) {
        if (e === S.player) {
          // offer to player (resolved asynchronously by UI)
          if (!S.msgs.some((m) => m.type === 'peace-offer' && m.from === f)) S.msgs.push({ type: 'peace-offer', from: f, demand: C.warScore(f, e) >= 25 ? Math.min(250, Math.max(0, Math.floor(S.factions[e].gold / 2))) : 0 });
        } else if (C.acceptsPeace(e, f)[0] || w.exh >= 14 || (w.exh >= 8 && rnd() < 0.3)) makePeace(f, e);
      }
    }
    // alliances against common enemies
    for (const e of wars(f)) {
      for (const x of Object.keys(S.factions)) {
        if (x === f || x === e || x === 'minor' || !S.factions[x].alive || allied(f, x) || atWar(f, x)) continue;
        if (atWar(x, e) && C.rel(f, x) > -10 && rnd() < 0.18) {
          if (x === S.player) { if (!S.msgs.some((m) => m.type === 'alliance-offer' && m.from === f)) S.msgs.push({ type: 'alliance-offer', from: f }); }
          else makeAlliance(f, x);
        }
      }
    }
    // declare war
    if (S.turn < 4) return;
    const engaged = wars(f).filter((x) => x !== 'minor').length;
    if (engaged >= 2) return;
    if (rnd() > 0.045 * aggr * (S.difficulty === 'hard' ? 1.3 : S.difficulty === 'easy' ? 0.7 : 1)) return;
    const myP = factionPower(f) + alliesOf(f).reduce((s, x) => s + factionPower(x) * 0.5, 0);
    let best = null, bs = 0;
    for (const e of Object.keys(S.factions)) {
      if (e === f || !S.factions[e].alive || allied(f, e) || atWar(f, e)) continue;
      if (S.truce && S.truce[pkey(f, e)] > S.turn) continue;
      // neighbours?
      let near = false;
      for (const p of C.provincesOf(f)) {
        const d = C.def(p.id);
        if (d.adj.some((i) => S.provinces[W().provs[i].id].owner === e)) { near = true; break; }
      }
      if (!near) continue;
      const theirP = factionPower(e) + alliesOf(e).reduce((s, x) => s + factionPower(x) * 0.7, 0);
      const ratio = (myP + 1) / (theirP + 1);
      if (ratio < 1.15) continue;
      const rl = C.rel(f, e);
      if (rl > 25) continue;
      const score = ratio - rl / 100 + (e === 'minor' ? 0.6 : 0) + (e === S.player ? -0.1 : 0);
      if (score > bs) { bs = score; best = e; }
    }
    if (best) declareWar(f, best, 0, null);
  }

  function aiMoves(f) {
    const en = wars(f).filter((x) => S.factions[x].alive);
    const armies = C.armiesOf(f);
    if (!armies.length) return;
    // merge stacks
    for (const a of armies) {
      if (!S.armies.includes(a)) continue;
      for (const b of armies) {
        if (a === b || !S.armies.includes(b) || a.prov !== b.prov) continue;
        if (a.units.length >= b.units.length && a.units.length + b.units.length <= MAX_STACK && (a.units.length >= 5 || b.units.length < 5 || true)) {
          if (b.units.length < 9 || a.units.length < 9) C.mergeArmies(a, b);
        }
      }
    }
    const list = C.armiesOf(f).sort((x, y) => C.armyPower(y) - C.armyPower(x));
    const enemyArmies = S.armies.filter((a) => en.includes(a.owner));
    if (!en.length) {
      // peace: return home
      for (const a of list) {
        a.path = [];
        if (!canEnter(f, a.prov) || S.provinces[a.prov].owner !== f && !allied(f, S.provinces[a.prov].owner)) {
          const home = C.provincesOf(f)[0];
          if (home) C.orderMove(a, home.id);
        }
      }
      return;
    }
    const mainPower = list.length ? C.armyPower(list[0]) : 0;
    list.forEach((a, idx) => {
      if (!S.armies.includes(a)) return;
      a.path = [];
      const ps = S.provinces[a.prov];
      const myPow = C.armyPower(a);
      // keep besieging
      if (ps.siege && ps.siege.by === f) {
        const adjThreat = enemyArmies.filter((e) => nbrs(e.owner, e.prov).includes(a.prov)).reduce((s, e) => s + C.armyPower(e), 0);
        if (adjThreat < myPow * 1.6) {
          if (ps.fort >= 1 && !C.assaultCheck(a) && myPow > C.garrisonStrength(a.prov) * 3.2 && rnd() < 0.3) C.assault(a);
          return;
        }
      }
      const { dist, prev } = C.bfsAll(f, a.prov, 6);
      let best = null, bscore = 0;
      for (const id in dist) {
        if (id === a.prov) continue;
        const d = dist[id], q = S.provinces[id], qd = C.def(id);
        const enemiesThere = enemyArmies.filter((e) => e.prov === id);
        const ePow = enemiesThere.reduce((s, e) => s + C.armyPower(e), 0);
        let val = 0;
        if (en.includes(q.owner)) {
          val = 2 + qd.income / 2 + (qd.capital ? 5 : 0) + (S.factions[q.owner].cap === id ? 3 : 0);
          val -= q.fort * (a.units.filter((u) => u.type === 'art').length >= 2 ? 0.8 : 1.6);
          if (q.siege && q.siege.by === f) val += 1;
        } else if (q.owner === f) {
          const near = enemyArmies.filter((e) => e.prov === id || nbrs(e.owner, e.prov).includes(id));
          if (near.length) val = 4 + (qd.capital ? 4 : 0) + qd.income / 3;
        }
        if (ePow > 0) {
          if (myPow < ePow * 0.85) { val = 0; }
          else val += 3 + Math.min(4, (myPow / ePow));
        }
        // friendly stack to join if we're weak
        if (myPow < mainPower * 0.45 && idx > 0) {
          const big = list[0];
          if (id === big.prov) val = Math.max(val, 5);
        }
        // don't wander into minor/neutral lands
        if (!canEnter(f, id)) val = 0;
        if (val <= 0) continue;
        // sea transport only for aggressive navies
        let seaHops = 0; let c = id; while (c && prev[c]) { if (isSea(prev[c], c)) seaHops++; c = prev[c]; }
        if (seaHops) {
          if (S.turn < 6 || seaHops > 1 || a.units.length > SEA_CAP || a.units.length < 6 || myPow < 4500 || rnd() < 0.6) continue;
        }
        const score = val / (d + 0.6);
        if (score > bscore) { bscore = score; best = id; }
      }
      if (best) {
        const path = []; let c = best; while (c !== a.prov) { path.unshift(c); c = prev[c]; }
        a.path = path;
      } else {
        // retreat toward capital if outnumbered nearby
        const threat = enemyArmies.filter((e) => e.prov === a.prov || nbrs(e.owner, e.prov).includes(a.prov)).reduce((s, e) => s + C.armyPower(e), 0);
        if (threat > myPow * 1.4) {
          const cap = S.factions[f].cap && S.provinces[S.factions[f].cap].owner === f ? S.factions[f].cap : null;
          if (cap) C.orderMove(a, cap);
        }
      }
    });
  }

  C.aiPlan = function (f) {
    if (!S.factions[f].alive || f === 'minor') return;
    aiDiplomacy(f);
    aiRecruit(f);
    aiGenerals(f);
    if (f !== S.player || S.autoplay) aiMoves(f);
  };

  // -------------------------------------------------------------------- events
  function sameWar(a, b, why) { return declareWar(a, b, 0, why); }
  const alive = (f) => S.factions[f] && S.factions[f].alive;
  function coalition(members, target, label) {
    members.forEach((m) => { if (m !== target && alive(m) && alive(target) && !atWar(m, target) && !allied(m, target) && m !== S.player) sameWar(m, target, label); });
  }
  function spawnUnits(f, pid, spec) {
    const units = parseSpec(spec);
    const a = C.makeArmy(f, pid, units);
    return a;
  }
  function randomOwned(f) { const ps = C.provincesOf(f); return ps.length ? ps[Math.floor(rnd() * ps.length)] : null; }

  C.EVENTS = [
    {
      id: 'coalition3', y: 1805, m: 6, title: 'The Third Coalition',
      text: 'Alarmed by French expansion, Britain, Austria, Russia and their allies form the Third Coalition against Napoleon.',
      players: ['britain', 'austria', 'russia', 'sweden', 'naples'], target: 'france',
      choices: (S) => [{ label: 'Join the coalition (declare war on France, +200 gold)', run: () => { sameWar(S.player, 'france', 'Third Coalition'); S.factions[S.player].gold += 200; } }, { label: 'Stay neutral', run: () => {} }],
      run: () => coalition(['britain', 'austria', 'russia', 'sweden', 'naples'], 'france', 'Third Coalition')
    },
    {
      id: 'trafalgar', y: 1805, m: 10, title: 'Trafalgar',
      text: 'Nelson destroys the Franco-Spanish fleet off Cape Trafalgar. British trade and supply routes are secure; French and Spanish overseas commerce suffers.',
      run: () => {
        if (!atWar('britain', 'france') && !atWar('britain', 'spain')) return;
        S.factions.britain.gold += 150;
        S.factions.france.gold -= 100; S.factions.spain.gold -= 150;
      }
    },
    {
      id: 'rhine', y: 1806, m: 7, title: 'Confederation of the Rhine',
      text: 'The German states of the Rhine renounce the Holy Roman Empire and place themselves under French protection.',
      run: () => { if (alive('bavaria') && alive('france') && !allied('france', 'bavaria') && !atWar('france', 'bavaria') && S.player !== 'bavaria') makeAlliance('france', 'bavaria'); }
    },
    {
      id: 'continental', y: 1806, m: 11, title: 'The Continental System',
      text: 'Napoleon\'s Berlin Decree closes European ports to British trade. Britain\'s commerce suffers, but so does the trade of the continent.',
      run: () => { S.factions.britain.incomeMult *= 0.88; for (const f of ['france', 'prussia', 'denmark', 'russia', 'spain']) if (alive(f)) S.factions[f].incomeMult *= 0.96; }
    },
    {
      id: 'prussiawar', y: 1806, m: 9, title: 'Prussia Mobilises',
      text: 'Outraged by French meddling in Germany, Prussia moves toward war with France.',
      cond: () => alive('prussia') && alive('france') && S.player !== 'prussia' && !atWar('prussia', 'france') && !allied('prussia', 'france'),
      run: () => { sameWar('prussia', 'france', 'Fourth Coalition'); if (alive('russia') && S.player !== 'russia') sameWar('russia', 'france', 'Fourth Coalition'); }
    },
    {
      id: 'tilsit', y: 1807, m: 7, title: 'Treaty of Tilsit',
      text: 'Alexander I and Napoleon meet on a raft at the Neman. An uneasy peace is struck between France and Russia.',
      cond: () => atWar('russia', 'france'),
      players: ['russia', 'france'],
      choices: () => [{ label: 'Sign the treaty (peace)', run: () => { makePeace('russia', 'france'); } }, { label: 'Fight on', run: () => {} }],
      run: () => { if (S.player === 'russia' || S.player === 'france') return; if (atWar('russia', 'france')) { makePeace('russia', 'france'); if (rnd() < 0.5) makeAlliance('russia', 'france'); } }
    },
    {
      id: 'wellesley', y: 1808, m: 4, title: 'Wellesley Takes Command',
      text: 'Sir Arthur Wellesley, victor of India, is given command of a British army for the Peninsula.',
      run: () => { /* generals arrive by year anyway */ }
    },
    {
      id: 'spain1808', y: 1808, m: 5, title: 'The Spanish Uprising',
      text: 'The people of Madrid rise against the French. Juntas form across Spain; guerrilla bands harass the occupiers.',
      cond: () => alive('france') && alive('spain'),
      run: () => {
        if (allied('france', 'spain') && S.player !== 'spain') { delete S.allies[pkey('france', 'spain')]; sameWar('spain', 'france', 'Peninsular uprising'); }
        for (const p of W().provs.filter((x) => x.owner === 'spain' || x.owner === 'portugal')) {
          const ps = S.provinces[p.id], owner = p.owner;
          if (ps.owner === owner) { if (S.player !== owner) spawnUnits(owner, p.id, 'line:2 light:1'); continue; }
          const occupier = ps.owner;
          if (occupier === 'france' || allied(occupier, 'france')) {
            if (!S.armies.some((a) => a.prov === p.id && a.owner === occupier && C.armyPower(a) > 8000)) {
              for (const a of S.armies.filter((x) => x.prov === p.id && x.owner === occupier)) removeArmy(a);
              ps.owner = owner; ps.siege = null;
              spawnUnits(owner, p.id, 'line:3 light:2');
            }
          }
        }
        S.factions.spain.gold += 300;
        NAP.recolor(S);
      }
    },
    {
      id: 'austria1809', y: 1809, m: 4, title: 'Austria Strikes Again',
      text: 'Emboldened by French troubles in Spain, Austria declares war on France once more.',
      cond: () => alive('austria') && alive('france') && S.player !== 'austria' && !atWar('austria', 'france') && !allied('austria', 'france'),
      run: () => { sameWar('austria', 'france', 'Fifth Coalition'); S.factions.austria.gold += 200; }
    },
    {
      id: 'russia1812', y: 1812, m: 6, title: 'The Grande Armee Crosses the Neman',
      text: 'Napoleon invades Russia with the largest army ever assembled. The Russian winter will be a deadly ally of the Tsar.',
      cond: () => alive('france') && alive('russia') && S.player !== 'france' && !atWar('france', 'russia'),
      run: () => { sameWar('france', 'russia', 'invasion of Russia'); S.factions.france.gold += 300; S.factions.france.incomeMult = 1; }
    },
    {
      id: 'coalition6', y: 1813, m: 3, title: 'The Sixth Coalition',
      text: 'After the disaster in Russia, Prussia, Austria, Sweden and Russia rise against a weakened France.',
      players: ['prussia', 'austria', 'sweden', 'russia', 'britain'], target: 'france',
      choices: (S) => [{ label: 'Join the coalition (declare war on France, +250 gold)', run: () => { sameWar(S.player, 'france', 'Sixth Coalition'); S.factions[S.player].gold += 250; } }, { label: 'Stay neutral', run: () => {} }],
      cond: () => alive('france'),
      run: () => coalition(['prussia', 'austria', 'sweden', 'russia', 'britain'], 'france', 'Sixth Coalition')
    },
    {
      id: 'hre', y: 1806, m: 8, title: 'End of the Holy Roman Empire',
      text: 'Francis II lays down the imperial crown. A thousand years of German tradition ends; Austria\'s prestige is shaken and the German princes look to Paris.',
      run: () => { if (alive('austria') && alive('bavaria')) { addRel('austria', 'bavaria', -15); addRel('france', 'bavaria', 15); } if (alive('austria')) S.factions.austria.gold -= 100; }
    },
    {
      id: 'fontainebleau', y: 1807, m: 10, title: 'Treaty of Fontainebleau',
      text: 'France and Spain agree to partition Portugal, Britain\'s oldest ally. French columns march toward Lisbon.',
      cond: () => alive('france') && alive('portugal') && S.player !== 'france' && !atWar('france', 'portugal') && !allied('france', 'portugal'),
      run: () => { sameWar('france', 'portugal', 'Treaty of Fontainebleau'); if (alive('spain') && allied('france', 'spain')) sameWar('spain', 'portugal', 'Treaty of Fontainebleau'); }
    },
    {
      id: 'copenhagen', y: 1807, m: 9, title: 'The Bombardment of Copenhagen',
      text: 'Fearing the Danish fleet will fall to Napoleon, Britain strikes first. Denmark-Norway is driven into the French camp.',
      cond: () => alive('britain') && alive('denmark') && S.player !== 'britain' && !atWar('britain', 'denmark'),
      run: () => { S.factions.denmark.gold -= 150; if (S.player !== 'denmark') sameWar('denmark', 'britain', 'bombardment of Copenhagen'); addRel('denmark', 'france', 30); }
    },
    {
      id: 'finnishwar', y: 1808, m: 2, title: 'The Finnish War',
      text: 'Russia, bound to Napoleon by Tilsit, invades Swedish Finland.',
      cond: () => alive('russia') && alive('sweden') && S.player !== 'russia' && !atWar('russia', 'sweden') && !allied('russia', 'sweden'),
      run: () => sameWar('russia', 'sweden', 'Finnish War')
    },
    {
      id: 'torres', y: 1810, m: 10, title: 'The Lines of Torres Vedras',
      text: 'Wellington\'s engineers fortify the approaches to Lisbon. The French will break themselves upon the lines.',
      cond: () => alive('portugal') && S.provinces.lisbon.owner === 'portugal',
      run: () => { S.provinces.lisbon.fort = Math.min(3, S.provinces.lisbon.fort + 1); }
    },
    {
      id: 'serbia', y: 1807, m: 5, title: 'Serbian Uprising',
      text: 'Karadjordje\'s rebels throw off Ottoman rule in the Balkans, tying down the Sultan\'s armies.',
      cond: () => alive('ottoman') && S.provinces.serbia.owner === 'ottoman',
      run: () => { const a = S.armies.filter((x) => x.prov === 'serbia' && x.owner === 'ottoman'); applyCasualties(a, 0.15); S.factions.ottoman.gold -= 120; }
    },
    {
      id: 'bucharest', y: 1812, m: 5, title: 'Treaty of Bucharest',
      text: 'With Napoleon\'s invasion looming, Russia makes peace with the Ottomans to free its southern armies.',
      cond: () => atWar('russia', 'ottoman'),
      run: () => { if (S.player !== 'russia' && S.player !== 'ottoman') makePeace('russia', 'ottoman'); else { S.factions.russia.gold += 100; } }
    },
    {
      id: 'leipzig', y: 1813, m: 10, title: 'Defection after Leipzig',
      text: 'The Battle of the Nations goes against Napoleon. Bavaria abandons the French alliance and joins the coalition.',
      cond: () => alive('bavaria') && alive('france') && S.player !== 'bavaria' && allied('france', 'bavaria'),
      run: () => { delete S.allies[pkey('france', 'bavaria')]; sameWar('bavaria', 'france', 'defection after Leipzig'); }
    },
    {
      id: 'vienna', y: 1814, m: 9, title: 'The Congress of Vienna',
      text: 'The powers gather in Vienna to remake Europe. Exhausted by two decades of war, the AI nations lay down their arms.',
      run: () => { for (const k of Object.keys(S.wars)) { const [a, b] = k.split('|'); if (a !== S.player && b !== S.player && a !== 'minor' && b !== 'minor') makePeace(a, b); } }
    },
    {
      id: 'hundred', y: 1815, m: 3, title: 'The Hundred Days',
      text: 'Napoleon escapes from Elba and marches on Paris. The old guard rally to the eagles once more!',
      cond: () => alive('france') && C.provincesOf('france').length < 12 && S.player !== 'france',
      run: () => {
        const p = randomOwned('france'); if (!p) return;
        const a = spawnUnits('france', p.id, 'line:8 guard:2 light:2 hussar:2 cuirass:1 art:2');
        const nap = Object.values(S.generals).find((g) => g.name === 'Napoleon Bonaparte');
        if (nap && nap.alive && !nap.assigned) C.assignGeneral(a, nap.id);
      }
    }
  ];

  const RANDOM_EVENTS = [
    { t: 'Bumper harvest', art: 'boon', text: (f) => `A bountiful harvest fills the granaries of ${F(f).name}. +120 gold.`, run: (f) => { S.factions[f].gold += 120; } },
    { t: 'Financial crisis', art: 'disaster', text: (f) => `Banks falter in ${F(f).name}. -150 gold.`, run: (f) => { S.factions[f].gold -= 150; } },
    { t: 'Patriotic fervour', art: 'flags', text: (f) => `A wave of patriotism sweeps ${F(f).name}. +800 manpower.`, run: (f) => { S.factions[f].manpower += 800; } },
    { t: 'Typhus outbreak', art: 'disaster', text: (f) => `Camp fever spreads through the armies of ${F(f).name}.`, run: (f) => { applyCasualties(C.armiesOf(f), 0.04); } },
    { t: 'Army reforms', art: 'flags', text: (f) => `Reformers modernise the army of ${F(f).name}. Veterans rally to the colours (+600 manpower).`, run: (f) => { S.factions[f].manpower += 600; } },
    { t: 'Smuggling boom', art: 'boon', text: (f) => `Smugglers bring tariff-free goods into ${F(f).name}. +100 gold.`, run: (f) => { S.factions[f].gold += 100; } },
    { t: 'Mutiny', art: 'disaster', text: (f) => `Unpaid troops mutiny in the army of ${F(f).name}.`, run: (f) => { const a = C.armiesOf(f); if (a.length) applyCasualties([a[Math.floor(rnd() * a.length)]], 0.1); } },
    { t: 'Merchant loans', art: 'boon', text: (f) => `Bankers extend a generous loan to ${F(f).name}. +200 gold.`, run: (f) => { S.factions[f].gold += 200; } }
  ];

  async function runEvents() {
    for (const ev of C.EVENTS) {
      if (S.fired[ev.id]) continue;
      if (S.year < ev.y || (S.year === ev.y && S.month < ev.m)) continue;
      if (ev.cond && !ev.cond()) { if (S.year > ev.y + 1) S.fired[ev.id] = true; continue; }
      S.fired[ev.id] = true;
      const inPlayers = ev.players && ev.players.includes(S.player) && (!ev.target || ev.target !== S.player);
      let note = '';
      const ch = inPlayers && ev.choices ? ev.choices(S) : null;
      const useChoices = ch && ch.length && !(ev.id.startsWith('coalition') && atWar(S.player, 'france'));
      if (useChoices) {
        const idx = await H().event(ev, ch);
        // AI factions still act
        ev.run();
        (ch[idx] || ch[ch.length - 1]).run();
        C.log(`${ev.title}: ${ev.text}`, 'event');
      } else {
        ev.run();
        await H().event(ev, null);
        C.log(`${ev.title}: ${ev.text}`, 'event');
      }
    }
    // random events (player flavour only displayed if affects player; others silent)
    if (rnd() < 0.12) {
      const fs = Object.keys(S.factions).filter((f) => alive(f) && f !== 'minor');
      const f = fs[Math.floor(rnd() * fs.length)];
      const ev = RANDOM_EVENTS[Math.floor(rnd() * RANDOM_EVENTS.length)];
      ev.run(f);
      if (f === S.player) { C.log(`${ev.t}: ${ev.text(f)}`, 'event'); await H().event({ title: ev.t, text: ev.text(f), art: ev.art }, null); }
    }
  }

  function arrivals() {
    for (const g of Object.values(S.generals)) {
      if (!g.arrived && g.from <= S.year && alive(g.owner)) {
        g.arrived = true; S.pool[g.owner].push(g.id);
        plog(`General ${g.name} (${g.trait}) joins ${F(g.owner).name}.`, 'good', [g.owner]);
      }
    }
  }

  function relationDrift() {
    for (const a of Object.keys(S.factions)) for (const b of Object.keys(S.factions)) {
      if (a >= b || a === 'minor' || b === 'minor') continue;
      if (allied(a, b)) addRel(a, b, 1);
      else if (atWar(a, b)) addRel(a, b, -2);
      else {
        const common = wars(a).filter((x) => atWar(b, x)).length;
        if (common) addRel(a, b, 1);
        else { const k = pkey(a, b); const r = S.rel[k] || 0; if (r > 0) S.rel[k] = r - 0.2; else if (r < 0) S.rel[k] = r + 0.2; }
      }
    }
  }

  function checkVictory() {
    const total = W().provs.length;
    const pf = S.player;
    const mine = C.provincesOf(pf).length;
    if (!S.factions[pf].alive || mine === 0) return { won: false, reason: `${F(pf).name} has been eliminated. Your story ends here.` };
    if (mine >= total * WIN_SHARE) return { won: true, reason: `You control ${mine} of ${total} provinces — Europe is yours!` };
    const rivals = Object.keys(S.factions).filter((f) => f !== pf && f !== 'minor' && alive(f));
    if (!rivals.length) return { won: true, reason: 'All rival powers have fallen.' };
    if (S.year > 1815 || (S.year === 1815 && S.month > 12)) return { won: mine >= total * 0.3, reason: `The age of Napoleon closes with ${mine} provinces under your flag (${Math.round((mine / total) * 100)}% of Europe).`, ended: true };
    return null;
  }

  // Full end-of-turn. Returns {victory?}.
  C.endTurn = async function () {
    if (S.busy || S.winner) return;
    S.busy = true;
    S.msgs = [];
    S.turnLog = [];
    const g0 = S.factions[S.player].gold, p0 = C.provincesOf(S.player).map((p) => p.id);
    const ids = Object.keys(S.factions).filter((f) => S.factions[f].alive && f !== 'minor');
    expelFromTerritory();
    // AI planning
    for (const f of ids) if (f !== S.player || S.autoplay) C.aiPlan(f);
    // The player's own faction: no AI planning besides recruiting handled by the user
    // Movement (rotate starting faction for fairness)
    const order = [S.player, ...ids.filter((f) => f !== S.player)];
    const rot = S.turn % order.length;
    const rotated = order.slice(rot).concat(order.slice(0, rot));
    for (const f of rotated) {
      for (const a of C.armiesOf(f)) {
        if (!S.armies.includes(a)) continue;
        await stepArmy(a);
      }
      siegePhase(f);
    }
    // minor faction sieges (they never move) - none
    attrition();
    for (const a of S.armies.slice()) if (!a.units.length) removeArmy(a);
    economyPhase();
    arrivals();
    relationDrift();
    // date
    S.turn++;
    S.month++; if (S.month > 12) { S.month = 1; S.year++; }
    await runEvents();
    NAP.recolor(S);
    // player-facing diplomatic offers
    const offers = S.msgs.slice(); S.msgs = [];
    for (const m of offers) {
      if (S.winner) break;
      if (m.type === 'peace-offer' && atWar(m.from, S.player)) {
        const ok = await H().offer(m);
        if (ok) { if (m.demand) { S.factions[S.player].gold -= m.demand; S.factions[m.from].gold += m.demand; } makePeace(m.from, S.player); }
      } else if (m.type === 'alliance-offer' && !allied(m.from, S.player)) {
        const ok = await H().offer(m);
        if (ok) makeAlliance(m.from, S.player);
      }
    }
    const p1 = C.provincesOf(S.player).map((p) => p.id);
    S.summary = { gold0: g0, gold1: S.factions[S.player].gold, income: C.factionIncome(S.player), upkeep: C.factionUpkeep(S.player), gained: p1.filter((x) => !p0.includes(x)), lost: p0.filter((x) => !p1.includes(x)), entries: S.turnLog.slice(), date: C.dateStr() };
    const v = checkVictory();
    if (v && !S.noVictory) S.winner = v;
    S.busy = false;
    H().refresh();
    return v;
  };

  C.income = (f) => C.factionIncome(f);

  // Serialise
  C.serialize = () => JSON.stringify(S);
  C.deserialize = (txt) => { S = JSON.parse(txt); NAP.recolor(S); return S; };
})();
