/* NAPWORLD - real-time tactical battles (rectangles on a field) */
(function () {
  const NAP = window.NAP;
  const FW = 1600, FH = 900;
  const FIRE_RATE = 0.6; // overall lethality of shooting: lower = longer, easier-to-read battles
  const TAU = Math.PI * 2;
  const rnd = Math.random;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // Battle stats per unit class/type
  const BT = {
    line:    { range: 140, fire: 0.0050, melee: 0.0036, speed: 24, turn: 1.6, forms: ['line', 'column', 'square'] },
    militia: { range: 115, fire: 0.0032, melee: 0.0026, speed: 24, turn: 1.4, forms: ['line', 'column', 'square'] },
    light:   { range: 165, fire: 0.0044, melee: 0.0030, speed: 34, turn: 2.2, forms: ['skirmish', 'line', 'column', 'square'] },
    grenadier:{ range: 145, fire: 0.0062, melee: 0.0058, speed: 23, turn: 1.6, forms: ['line', 'column', 'square'] },
    lancer:  { range: 0,   fire: 0,      melee: 0.0058, speed: 66, turn: 2.8, forms: ['line'] },
    hart:    { range: 400, fire: 0,      melee: 0.0010, speed: 24, turn: 1.6, forms: ['line'] },
    guard:   { range: 150, fire: 0.0085, melee: 0.0075, speed: 24, turn: 1.6, forms: ['line', 'column', 'square'] },
    hussar:  { range: 0,   fire: 0,      melee: 0.0066, speed: 74, turn: 3.0, forms: ['line'] },
    cuirass: { range: 0,   fire: 0,      melee: 0.0090, speed: 58, turn: 2.6, forms: ['line'] },
    art:     { range: 480, fire: 0,      melee: 0.0010, speed: 11, turn: 1.0, forms: ['line'] }
  };
  const FORM_SPEED = { line: 0.85, column: 1.25, square: 0.35, skirmish: 1.1 };
  const FORM_FIRE = { line: 1.0, column: 0.3, square: 0.5, skirmish: 0.55 };
  const FORM_TAKE = { line: 1.0, column: 1.3, square: 1.0, skirmish: 0.5 };
  const FORM_CAV_VULN = { line: 1.0, column: 1.5, square: 0.10, skirmish: 1.8 };
  const FORM_ART_VULN = { line: 1.0, column: 1.6, square: 1.7, skirmish: 0.4 };
  const FORM_NAMES = { line: 'Line', column: 'Column', square: 'Square', skirmish: 'Skirmish' };

  const tintCache = {};
  // blend a #rrggbb colour toward white by amt (0..1)
  function tint(hex, amt) {
    if (amt <= 0.01) return hex;
    const key = hex + (Math.round(amt * 24)); if (tintCache[key]) return tintCache[key];
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, k = Math.min(1, amt);
    return (tintCache[key] = `rgb(${Math.round(r + (255 - r) * k)},${Math.round(g + (255 - g) * k)},${Math.round(b + (255 - b) * k)})`);
  }

  function dims(u) {
    const base = NAP.UNITS[u.type];
    const f = u.formation, n = clamp(u.men / base.men, 0.1, 1), sq = Math.sqrt(n);
    if (u.cls === 'inf') {
      if (f === 'line') return [base.w * (0.28 + 0.72 * sq) + 14, 11];
      if (f === 'column') return [24, 22 + 40 * sq];
      if (f === 'square') { const e = 40 * (0.42 + 0.58 * sq); return [e, e]; }
      return [base.w * (0.35 + 0.65 * sq) + 30, 20];
    }
    if (u.cls === 'cav') return [14 + 36 * sq, 11];
    return [14 + 16 * sq, 14];
  }

  function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  function turnToward(cur, want, maxStep) { const d = angDiff(want, cur); return Math.abs(d) <= maxStep ? want : cur + Math.sign(d) * maxStep; }

  class Battle {
    constructor(spec, root, done) {
      this.spec = spec; this.root = root; this.done = done;
      this.t = 0; this.deployPhase = true; this.speed = 0.5; this.paused = true; this.over = false; this.acc = 0;
      this.units = []; this.proj = []; this.sparks = []; this.floaters = []; this.groups = {}; this.hoverUnit = null; this.puffs = []; this.shots = []; this.dead = []; this.msgs = [];
      this.sel = new Set();
      this.cam = { x: FW / 2, y: FH / 2, z: 1 }; this.zt = 1; this.zAnchor = null;
      this.keys = {};
      this.nextId = 1;
      this.rallyCd = [0, 0];
      this.initialMen = [0, 0];
      this.deadGen = [];
      this.genDead = [false, false];
      const W = spec.weather || 'clear';
      this.wx = { fire: W === 'rain' ? 0.65 : 1, artFire: W === 'rain' ? 0.85 : 1, speed: W === 'rain' ? 0.9 : W === 'snow' ? 0.85 : 1, range: W === 'fog' ? 0.7 : 1, fat: W === 'snow' ? 1.3 : 1 };
      this.timeLimit = spec.tod === 'dusk' ? 420 : 600;
      this.weatherName = { clear: 'Clear', rain: 'Rain', fog: 'Fog', snow: 'Snow' }[W] + ({ dawn: ' · Dawn', day: '', dusk: ' · Dusk' }[spec.tod || 'day']);
      const att = spec.playerIsAttacker, mtn = spec.terrain === 'm' ? 40 : 0;
      this.zoneR = (att ? 540 : 680) - mtn;               // player's deployment limit (x)
      this.zoneL = FW - ((att ? 680 : 540) - mtn);        // enemy's deployment limit (x)
      this.rec = []; this.recAcc = 0; this.recStatic = null;
      if (NAP.audio) NAP.audio.music('battle');
      this.buildTerrain();
      this.prerender();
      this.deploy();
      this.objs = (this.terrain.objs || []).map((o) => ({ ...o, c: 0, owner: -1, p: [0, 0] }));
      this.vp = [0, 0]; this.vpT = 0; this.holdT = [0, 0]; this.endReason = '';
      this.rallyBase = [0, 1].map((sd) => (((this.spec.sides[sd].general || {}).traits || []).includes('inspiring') ? 28 : 35));
      this.buildHUD();
      this.bind();
      this.resize();
      this.last = performance.now();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }

    // ---------------------------------------------------------- setup
    buildTerrain() {
      const tr = this.spec.terrain;
      let seed = 0; for (const ch of this.spec.provName) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
      const r = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      const T = { hills: [], forests: [], villages: [], rocks: [], base: { p: '#93ad6c', h: '#a0a56f', f: '#7a9863', m: '#a39d88' }[tr] };
      const place = (n, f, minX = 520, maxX = 1080) => { for (let i = 0; i < n; i++) f(minX + r() * (maxX - minX), 90 + r() * (FH - 180)); };
      const nh = { p: 1, h: 3, f: 1, m: 4 }[tr], nf = { p: 2, h: 2, f: 6, m: 1 }[tr], nv = { p: 2, h: 1, f: 1, m: 0 }[tr];
      place(nh, (x, y) => T.hills.push({ x, y, r: 90 + r() * 90 }), 380, 1220);
      place(nf, (x, y) => T.forests.push({ x, y, rx: 60 + r() * 70, ry: 45 + r() * 60, trees: Array.from({ length: 26 }, () => [(r() - 0.5) * 2, (r() - 0.5) * 2, 7 + r() * 6]) }), 330, 1270);
      place(nv, (x, y) => {
        const hs = [], n = 6 + Math.floor(r() * 3);
        for (let i = 0; i < n; i++) { const row = i % 2; hs.push([-46 + (i >> 1) * 27 + (r() - 0.5) * 5, row ? 15 + r() * 5 : -19 - r() * 5, 15 + r() * 6, 11 + r() * 4, r() < 0.5 ? 0 : 1]); }
        T.villages.push({ x, y, hs, church: { x: 50 + r() * 6, y: -2 + r() * 6 }, fields: Array.from({ length: 4 }, (_, i) => [(i % 2 ? 1 : -1) * (70 + r() * 15), -34 + Math.floor(i / 2) * 50, 34 + r() * 14, 22 + r() * 8, Math.floor(r() * 3)]) });
      }, 600, 1000);
      if (tr === 'm') place(7, (x, y) => T.rocks.push({ x, y, r: 16 + r() * 18, a: r() * 6 }), 380, 1220);
      // drop trees outside their ellipse
      T.forests.forEach((f) => (f.trees = f.trees.filter((t) => t[0] * t[0] + t[1] * t[1] <= 1)));
      // fortification marker for siege defences (decor only)
      T.fort = this.spec.fort || 0;
      T.works = [];
      if (T.fort > 0 && this.spec.fortSide >= 0) {
        const att = this.spec.playerIsAttacker, side = this.spec.fortSide;
        const bx = side === 0 ? (att ? 310 : 410) : (att ? 1200 : 1290);
        const n = 3 + 2 * T.fort, span = (FH - 180) / n;
        for (let i = 0; i < n; i++) T.works.push({ x: bx, y: 90 + span * (i + 0.5), w: 38, h: span * 0.82 });
      }
      T.caps = [
        ...T.hills.map((h) => ({ x: h.x, y: h.y - h.r * 0.5, t: 'HILL', c: 'rgba(95,72,30,0.8)' })),
        ...T.forests.map((f) => ({ x: f.x, y: f.y - f.ry - 9, t: 'WOODS', c: 'rgba(25,75,32,0.85)' })),
        ...T.villages.map((v) => ({ x: v.x, y: v.y - 54, t: 'VILLAGE', c: 'rgba(110,45,22,0.9)' })),
        ...T.rocks.slice(0, 3).map((k) => ({ x: k.x, y: k.y - k.r - 8, t: 'CRAGS', c: 'rgba(70,66,58,0.9)' }))
      ];
      T.objs = [];
      if (T.villages.length) T.objs.push({ x: T.villages[0].x, y: T.villages[0].y, r: 75, name: 'Village' });
      if (T.hills.length) { const h = [...T.hills].sort((a, b) => b.r - a.r)[0]; T.objs.push({ x: h.x, y: h.y, r: Math.min(95, h.r), name: 'Hill' }); }
      while (T.objs.length < 2) T.objs.push({ x: 800 + (T.objs.length ? (r() - 0.5) * 240 : 0), y: 160 + r() * 580, r: 80, name: 'Crossroads' });
      T.noise = Array.from({ length: 180 }, () => [r() * FW, r() * FH, 20 + r() * 50, r()]);
      this.terrain = T;
    }

    terrainAt(x, y) {
      const T = this.terrain;
      let speed = 1, cover = 1, hill = false, forest = false, village = false;
      for (const w of T.works) if (Math.abs(x - w.x) < w.w / 2 && Math.abs(y - w.y) < w.h / 2) { cover *= 0.55; speed *= 0.7; }
      for (const h of T.hills) if ((x - h.x) ** 2 + (y - h.y) ** 2 < h.r * h.r) { hill = true; speed *= 0.85; cover *= 0.88; }
      for (const f of T.forests) if (((x - f.x) / f.rx) ** 2 + ((y - f.y) / f.ry) ** 2 < 1) { forest = true; speed *= 0.6; cover *= 0.72; }
      for (const v of T.villages) if (Math.abs(x - v.x) < 62 && Math.abs(y - v.y) < 38) { village = true; speed *= 0.7; cover *= 0.7; }
      for (const k of T.rocks) if ((x - k.x) ** 2 + (y - k.y) ** 2 < k.r * k.r) speed *= 0.4;
      if (this.spec.terrain === 'm') speed *= 0.9;
      return { speed, cover, hill, forest, village };
    }

    mkUnit(src, side, x, y) {
      const base = NAP.UNITS[src.type], bt = BT[src.type];
      const fac = NAP.FACTIONS[src.faction];
      const g = this.spec.sides[side].general;
      const u = {
        id: this.nextId++, side, ref: src.ref, type: src.type, cls: base.cls, faction: src.faction,
        x, y, facing: side === 0 ? 0 : Math.PI, men: src.men, max: src.max,
        baseMorale: clamp((base.morale * fac.morale + (g ? (g.lead - 3) * 2.2 : 0)) * (1 + 0.06 * (src.vet || 0)), 30, 115), vet: src.vet || 0,
        morale: 0, fatigue: src.fatigue || 0, formation: bt.forms[0], wantForm: null, formT: 0,
        state: 'idle', order: null, target: null, reload: rnd() * 4, routT: 0, calm: 0,
        kills: 0, start: src.men, impacted: false, charging: false, cooldown: 0, sinceHit: 99, role: 0, name: base.short,
        fireMul: fac.fire * (g ? 1 + (g.atk - 3) * 0.03 : 1) * (1 + 0.05 * (src.vet || 0)),
        takeMul: g ? 1 - (g.def - 3) * 0.025 : 1,
        shockMul: 1, hitT: 0, cumHit: 0, floatT: 1, dustT: 0, hoofT: 0
      };
      // general traits and staff officers
      const tr = (g && g.traits) || [], staff = this.spec.sides[side].staff || [];
      if (tr.includes('aggressive')) u.fireMul *= 1.06;
      if (tr.includes('defender')) u.takeMul *= 0.94;
      if (tr.includes('inspiring')) u.baseMorale += 5;
      if (tr.includes('artillery') && base.cls === 'art') u.fireMul *= 1.12;
      if (staff.includes('gunner') && base.cls === 'art') u.fireMul *= 1.10;
      if (base.cls === 'cav') u.shockMul = (tr.includes('cavalry') ? 1.15 : 1) * (staff.includes('horse') ? 1.10 : 1) * NAP.perk(src.faction, 'cav');
      if (base.cls === 'art') u.fireMul *= NAP.perk(src.faction, 'art');
      u.morale = u.baseMorale;
      if (u.type === 'light') u.formation = 'skirmish';
      [u.w, u.d] = dims(u);
      return u;
    }

    deploy() {
      const sides = this.spec.sides;
      for (let s = 0; s < 2; s++) {
        const us = sides[s].units;
        const inf = us.filter((u) => NAP.UNITS[u.type].cls === 'inf');
        const cav = us.filter((u) => NAP.UNITS[u.type].cls === 'cav');
        const art = us.filter((u) => NAP.UNITS[u.type].cls === 'art');
        const dir = s === 0 ? 1 : -1;
        const att = this.spec.playerIsAttacker;
        const baseX = s === 0 ? (att ? 310 : 410) : (att ? 1200 : 1290);
        const place = (arr, x, spread, jitter) => {
          arr.forEach((src, i) => {
            const n = arr.length;
            const y = FH / 2 + (i - (n - 1) / 2) * Math.min(spread, (FH - 160) / Math.max(1, n));
            const u = this.mkUnit(src, s, x + (rnd() - 0.5) * jitter, y);
            this.units.push(u);
          });
        };
        // infantry in two lines
        const first = inf.slice(0, Math.ceil(inf.length * 0.6)), second = inf.slice(Math.ceil(inf.length * 0.6));
        place(first, baseX, 74, 6);
        const i0 = this.units.length; place(second, baseX - dir * 70, 80, 8);
        for (let i = i0; i < this.units.length; i++) this.units[i].reserve = true;
        place(art, baseX + dir * 45, 90, 10);
        // cavalry on the wings
        cav.forEach((src, i) => {
          const wing = i % 2 === 0 ? -1 : 1, k = Math.floor(i / 2);
          const u = this.mkUnit(src, s, baseX - dir * 40 - k * 20, FH / 2 + wing * (300 + k * 50));
          u.role = i;
          this.units.push(u);
        });
        // general
        const g = sides[s].general;
        const gu = {
          id: this.nextId++, side: s, type: 'gen', cls: 'gen', faction: sides[s].faction, name: g ? g.name : 'Colonel', gen: g || { name: 'Colonel', atk: 3, def: 3, lead: 3 },
          x: baseX - dir * 120, y: FH / 2, facing: s === 0 ? 0 : Math.PI, men: 1, max: 1, morale: 100, baseMorale: 100, fatigue: 0,
          formation: 'line', w: 14, d: 14, state: 'idle', order: null, target: null, kills: 0, calm: 0
        };
        this.units.push(gu);
        this.units.filter((u) => u.side === s && u.cls !== 'gen').forEach((u) => (this.initialMen[s] += u.men));
        this.sides = sides;
      }
      // an AI defender digs in on the best nearby hill
      if (this.spec.playerIsAttacker) {
        const hills = this.terrain.hills.filter((h) => h.x > 960 && h.x < 1300).sort((a, b) => b.r - a.r);
        if (hills.length) {
          const mine = this.units.filter((u) => u.side === 1 && u.cls !== 'gen');
          const mx = mine.reduce((a, u) => a + u.x, 0) / mine.length, my = mine.reduce((a, u) => a + u.y, 0) / mine.length;
          const dx = Math.max(-120, Math.min(120, hills[0].x - mx)), dy = Math.max(-150, Math.min(150, hills[0].y - my));
          for (const u of this.units) if (u.side === 1 && u.cls !== 'gen' && u.cls !== 'cav') { u.x += dx; u.y = clamp(u.y + dy, 40, FH - 40); }
          const g = this.general(1); if (g) { g.x += dx; g.y = clamp(g.y + dy, 40, FH - 40); }
        }
      }
    }

    // ---------------------------------------------------------- queries
    alive(u) { return !u.fled && !u.dead && u.men > 0; }
    enemies(s) { return this.units.filter((u) => u.side !== s && u.cls !== 'gen' && this.alive(u)); }
    friends(s) { return this.units.filter((u) => u.side === s && u.cls !== 'gen' && this.alive(u)); }
    general(s) { return this.units.find((u) => u.side === s && u.cls === 'gen' && !u.dead); }
    ext(u, ang) { const d = Math.abs(angDiff(ang, u.facing)); return (u.d / 2) * Math.abs(Math.cos(d)) + (u.w / 2) * Math.abs(Math.sin(d)); }
    // Approximate gap between two units' bodies
    gap(a, b, ax, ay) {
      const x = ax === undefined ? a.x : ax, y = ay === undefined ? a.y : ay;
      const ang = Math.atan2(b.y - y, b.x - x);
      return Math.hypot(b.x - x, b.y - y) - this.ext(a, ang + Math.PI * 0) - this.ext(b, ang + Math.PI);
    }
    exposure(t, from) {
      if (t.formation === 'square' || t.formation === 'skirmish' || t.cls === 'art') return t.cls === 'art' ? 1.3 : 1;
      const a = Math.atan2(from.y - t.y, from.x - t.x), d = Math.abs(angDiff(a, t.facing));
      return d < 1.05 ? 1 : d < 2.1 ? 1.4 : 1.8;
    }
    strength(s) {
      let m = 0; for (const u of this.units) if (u.side === s && u.cls !== 'gen' && this.alive(u) && u.state !== 'routing') m += u.men;
      return m;
    }
    totalMen(s) { let m = 0; for (const u of this.units) if (u.side === s && u.cls !== 'gen' && this.alive(u)) m += u.men; return m; }

    // ---------------------------------------------------------- simulation
    msg(text) { this.msgs.unshift({ t: this.t, text }); if (this.msgs.length > 6) this.msgs.pop(); }

    damage(target, cas, src, moraleMul, kind) {
      cas = Math.min(target.men, cas * target.takeMul * (FORM_TAKE[target.formation] || 1));
      if (cas <= 0) return;
      target.men -= cas;
      target.sinceHit = 0; target.hitT = 0.3; target.cumHit = (target.cumHit || 0) + cas;
      if (src) src.kills += cas;
      const m = (cas / target.max) * 100 * 1.7 * (moraleMul || 1);
      target.morale -= m;
      if (target.men < 1) { target.men = 0; target.dead = true; }
      // blood stains
      if (rnd() < cas * 0.35 && this.dead.length < 900) { // fallen men lie where the regiment stood (offsets rotated with its facing)
        const lx = (rnd() - 0.5) * target.d, ly = (rnd() - 0.5) * target.w, cf = Math.cos(target.facing), sf = Math.sin(target.facing);
        this.dead.push([target.x + lx * cf - ly * sf, target.y + lx * sf + ly * cf, target.side]);
      }
    }

    record() {
      if (!this.recStatic) this.recStatic = this.units.map((u) => ({ id: u.id, side: u.side, type: u.type, cls: u.cls, faction: u.faction, name: u.name, max: u.max, baseMorale: u.baseMorale, w: u.w, d: u.d, gen: u.gen, wantForm: null, formation: u.formation, state: 'idle', men: u.men, morale: u.morale, fatigue: 0, x: u.x, y: u.y, facing: u.facing }));
      if (this.rec.length < 900) this.rec.push(this.units.map((u) => [u.x, u.y, u.facing, u.men, u.state === 'routing' ? 1 : u.state === 'fighting' ? 2 : 0, u.dead ? 1 : 0, u.fled ? 1 : 0, u.formation, u.morale]));
    }

    // ---- capture objectives (victory points)
    stepObjectives(dt) {
      for (const o of this.objs) {
        let p0 = 0, p1 = 0;
        for (const u of this.units) {
          if (u.cls === 'gen' || !this.alive(u) || u.state === 'routing') continue;
          if (Math.hypot(u.x - o.x, u.y - o.y) < o.r) { const m = u.men * (u.cls === 'art' ? 0.5 : 1); if (u.side === 0) p0 += m; else p1 += m; }
        }
        o.p = [p0, p1];
        if (p0 > p1 * 1.25 && p0 > 100) o.c = Math.max(-1, o.c - 0.1 * dt);
        else if (p1 > p0 * 1.25 && p1 > 100) o.c = Math.min(1, o.c + 0.1 * dt);
        else if (p0 + p1 === 0) o.c *= 1 - 0.02 * dt;
        o.owner = o.c <= -0.6 ? 0 : o.c >= 0.6 ? 1 : -1;
      }
      this.vpT += dt;
      if (this.vpT >= 1) { this.vpT -= 1; for (const o of this.objs) if (o.owner >= 0) this.vp[o.owner]++; }
      for (const sd of [0, 1]) this.holdT[sd] = this.objs.length && this.objs.every((o) => o.owner === sd) ? this.holdT[sd] + dt : 0;
    }

    // positional sound: pan and loudness follow the camera
    snd(name, gap, x, y) {
      if (!NAP.audio || this.replay || !this.canvas) return;
      const sk = this.fit * this.cam.z, hw = this.canvas.width / 2, hh = this.canvas.height / 2;
      const sx = (x - this.cam.x) * sk, sy = (y - this.cam.y) * sk;
      const off = Math.abs(sx) > hw || Math.abs(sy) > hh;
      NAP.audio.sfx(name, gap, { pan: clamp(sx / hw, -1, 1) * 0.9, vol: (off ? 0.4 : 1) * clamp(0.55 + 0.2 * this.cam.z, 0.55, 1) });
    }

    // Visible fire: muzzle flashes, tracer dashes, round shot, impacts
    fireVolley(u, tgt) {
      u.volleyT = this.t;
      const ca = Math.cos(u.facing), sa = Math.sin(u.facing);
      const mx = u.x + ca * (u.d / 2 + 3), my = u.y + sa * (u.d / 2 + 3);
      this.snd(u.cls === 'art' ? 'cannon' : 'musket', u.cls === 'art' ? 0.22 : 0.09, u.x, u.y);
      const room = this.proj.length < 650;
      if (u.cls === 'art') {
        const guns = clamp(Math.ceil(u.men / 10), 1, 8);
        for (let g = 0; g < guns && room; g++) {
          const py = guns === 1 ? 0 : ((g + 0.5) / guns - 0.5) * u.w;
          const x0 = mx - sa * py, y0 = my + ca * py;
          const x1 = tgt.x + (rnd() - 0.5) * tgt.w * 0.7, y1 = tgt.y + (rnd() - 0.5) * tgt.d * 0.7;
          const dist = Math.hypot(x1 - x0, y1 - y0);
          this.proj.push({ kind: 'ball', x0, y0, x1, y1, t: 0, delay: g * 0.08 + rnd() * 0.12, dur: Math.max(0.25, dist / 300) });
          this.puffs.push({ x: x0, y: y0, t: 0, life: 0.18, r: 9, c: 'rgba(255,215,120,', a: 0.9, nd: true });
          this.puffs.push({ x: x0 + ca * 3, y: y0 + sa * 3, t: 0, life: 4.5, r: 12, c: 'rgba(235,235,235,' });
        }
      } else {
        const n = clamp(Math.round(u.men / 55), 3, 14);
        for (let i = 0; i < n && room; i++) {
          const py = (rnd() - 0.5) * u.w;
          const x0 = mx - sa * py, y0 = my + ca * py;
          const x1 = tgt.x + (rnd() - 0.5) * tgt.w * 0.7, y1 = tgt.y + (rnd() - 0.5) * tgt.d * 0.7;
          const dist = Math.hypot(x1 - x0, y1 - y0);
          const delay = rnd() * 0.7;
          this.proj.push({ kind: 'bullet', x0, y0, x1, y1, t: 0, delay, dur: Math.max(0.12, dist / 480) });
          if (i % 3 === 0) this.puffs.push({ x: x0, y: y0, t: -delay, life: 0.14 + delay, r: 4.5, c: 'rgba(255,225,140,', a: 0.9, nd: true });
        }
        this.puffs.push({ x: mx + ca * 4, y: my + sa * 4, t: 0, life: 2.4, r: 8, c: 'rgba(235,235,235,' });
      }
      this.shots.push({ x0: mx, y0: my, x1: tgt.x, y1: tgt.y, t: 0, art: u.cls === 'art' });
    }

    step(dt) {
      this.t += dt;
      this.recAcc += dt; if (this.recAcc >= 1) { this.recAcc -= 1; this.record(); }
      for (const g of [0, 1]) this.rallyCd[g] = Math.max(0, this.rallyCd[g] - dt);
      // update in random order each tick so neither side gets a first-mover advantage
      const us = this.units.slice();
      for (let i = us.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const tmp = us[i]; us[i] = us[j]; us[j] = tmp; }
      // AI
      this.aiTimer = (this.aiTimer || 0) - dt;
      if (this.aiTimer <= 0) { this.aiTimer = 0.6; this.aiThink(1); if (this.spec.aiBothSides) this.aiThink(0); }
      for (const u of us) {
        if (u.cls === 'gen') { this.stepGeneral(u, dt); continue; }
        if (!this.alive(u)) continue;
        this.stepUnit(u, dt);
      }
      // morale contagion handled in stepUnit via routing events
      this.stepObjectives(dt);
      // effects decay
      for (const p of this.puffs) p.t += dt;
      this.puffs = this.puffs.filter((p) => p.t < p.life);
      for (const f of this.floaters) f.t += dt;
      this.floaters = this.floaters.filter((f) => f.t < 1.6);
      for (const s of this.shots) s.t += dt;
      this.shots = this.shots.filter((s) => s.t < 0.7);
      for (const p of this.proj) {
        p.t += dt;
        if (!p.hit && p.t >= p.delay + p.dur) {
          p.hit = true;
          if (p.kind === 'ball') {
            this.puffs.push({ x: p.x1, y: p.y1, t: 0, life: 1.3, r: 11, c: 'rgba(140,105,65,', a: 0.7 });
            this.puffs.push({ x: p.x1, y: p.y1, t: 0, life: 2.2, r: 9, c: 'rgba(95,95,95,', a: 0.5 });
            for (let i = 0; i < 7; i++) { const a = rnd() * TAU, v = 30 + rnd() * 50; this.sparks.push({ x: p.x1, y: p.y1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: 0.5 + rnd() * 0.3 }); }
          } else this.puffs.push({ x: p.x1, y: p.y1, t: 0, life: 0.45, r: 3.2, c: 'rgba(215,180,120,', a: 0.8, nd: true });
        }
      }
      this.proj = this.proj.filter((p) => p.t < p.delay + p.dur + 0.05);
      for (const q of this.sparks) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; }
      this.sparks = this.sparks.filter((q) => q.t < q.life);
      this.checkEnd();
    }

    stepGeneral(g, dt) {
      if (g.dead) return;
      if (g.order && g.order.type === 'move') {
        const dx = g.order.x - g.x, dy = g.order.y - g.y, d = Math.hypot(dx, dy);
        if (d < 3) g.order = null;
        else { const sp = 58 * dt; g.x += (dx / d) * Math.min(sp, d); g.y += (dy / d) * Math.min(sp, d); g.facing = Math.atan2(dy, dx); }
      }
      // danger: enemies in melee contact
      for (const e of this.units) {
        if (e.side === g.side || e.cls === 'gen' || !this.alive(e)) continue;
        if (Math.hypot(e.x - g.x, e.y - g.y) < 22 + e.w * 0.25 && e.state !== 'routing') {
          if (rnd() < 0.03 * dt * (e.cls === 'cav' ? 2 : 1)) {
            g.dead = true;
            this.deadGen.push(g.gen.id || null);
            this.genDead[g.side] = true;
            this.msg(`${g.name} has fallen!`);
            for (const u of this.units) if (u.side === g.side && u.cls !== 'gen') u.morale -= 14;
          }
        }
      }
    }

    stepUnit(u, dt) {
      const bt = BT[u.type], s = u.side;
      const en = this.enemies(s);
      u.sinceHit += dt;
      if (u.hitT > 0) u.hitT -= dt;
      u.floatT -= dt;
      if (u.floatT <= 0) { u.floatT = 1.0; if (u.cumHit >= 3) { this.floaters.push({ x: u.x, y: u.y - Math.max(u.w, u.d) / 2 - 14, txt: '-' + Math.round(u.cumHit), t: 0, side: u.side }); u.cumHit = 0; } }
      // formation transition
      if (u.wantForm) { u.formT -= dt; if (u.formT <= 0) { u.formation = u.wantForm; u.wantForm = null; [u.w, u.d] = dims(u); } }
      else [u.w, u.d] = dims(u);
      const g = this.general(s);
      const nearGen = g && !g.dead && Math.hypot(g.x - u.x, g.y - u.y) < 230;
      const tinfo = this.terrainAt(u.x, u.y);

      // ---------------- routing
      if (u.state === 'routing') {
        u.routT += dt;
        // flee away from nearest enemy, toward own edge
        let ax = s === 0 ? -1 : 1, ay = 0;
        const ne = this.nearest(u, en);
        if (ne) { const dx = u.x - ne.x, dy = u.y - ne.y, d = Math.hypot(dx, dy) || 1; ax = ax * 0.7 + dx / d * 0.5; ay = dy / d * 0.5; }
        const l = Math.hypot(ax, ay) || 1;
        const sp = bt.speed * 1.4 * (1 - u.fatigue / 250) * dt;
        u.x += (ax / l) * sp; u.y += (ay / l) * sp;
        u.facing = turnToward(u.facing, Math.atan2(ay, ax), 3 * dt);
        u.fatigue = Math.min(100, u.fatigue + 1.0 * dt);
        // pursuit by cavalry
        for (const e of en) if (e.cls === 'cav' && e.state !== 'routing' && Math.hypot(e.x - u.x, e.y - u.y) < 24) this.damage(u, e.men * 0.03 * dt, e, 0.2);
        // rally
        const close = ne && Math.hypot(ne.x - u.x, ne.y - u.y);
        u.morale += (!ne || close > 220 ? 3.2 : 0.2) * dt;
        if (u.morale > 42 && (!ne || close > 200) && u.routT > 6) { u.state = 'idle'; u.order = null; u.routT = 0; this.msg(`${u.name} rallies!`); }
        if (u.x < -40 || u.x > FW + 40 || u.y < -40 || u.y > FH + 40) { u.fled = true; this.msg(`${u.name} flees the field!`); }
        u.x = clamp(u.x, -60, FW + 60); u.y = clamp(u.y, -60, FH + 60);
        return;
      }

      // ---------------- find target / melee contact
      let melee = null, mg = 1e9;
      for (const e of en) {
        const gp = this.gap(u, e);
        if (gp < 3 && gp < mg) { mg = gp; melee = e; }
      }
      const maxRange = bt.range * (tinfo.hill ? 1.08 : 1) * this.wx.range;
      // a moving regiment that has an enemy in range ahead of it halts and opens fire (Ctrl+right-click orders a move that ignores enemies)
      if (u.order && u.order.type === 'move' && !u.order.run && !melee && bt.range > 0 && u.cls !== 'cav' && u.formation !== 'skirmish' && !u.wantForm) {
        const hd = Math.hypot(u.order.x - u.x, u.order.y - u.y) || 1, hx = (u.order.x - u.x) / hd, hy = (u.order.y - u.y) / hd, rr = maxRange * 0.95;
        for (const e of en) {
          if (e.state === 'routing') continue;
          const dx = e.x - u.x, dy = e.y - u.y, dd = Math.hypot(dx, dy);
          if (dd <= rr && (dx * hx + dy * hy) / (dd || 1) > 0.25) { u.order = null; u.target = e; break; }
        }
      }
      // order handling (movement)
      let moving = false;
      let moveSpeed = 0;
      if (u.order && !melee) {
        let tx = null, ty = null, stopDist = 2;
        if (u.order.type === 'move') { tx = u.order.x; ty = u.order.y; }
        else if (u.order.type === 'attack') {
          const t = u.order.target;
          if (!t || !this.alive(t)) { u.order = null; }
          else {
            tx = t.x; ty = t.y;
            if (u.cls === 'inf' && !u.order.charge) stopDist = Math.max(8, bt.range * 0.78);
            else stopDist = 0;
          }
        }
        if (u.order && tx !== null) {
          const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
          if (u.order.type === 'attack' && stopDist > 0 && d <= stopDist) { u.order.holdFire = true; moving = false; }
          else if (d <= (u.order.type === 'move' ? 3 : stopDist)) {
            if (u.order.type === 'move') { if (u.order.fa !== undefined) u.facing = turnToward(u.facing, u.order.fa, bt.turn * dt); const done = u.order.fa === undefined || Math.abs(angDiff(u.order.fa, u.facing)) < 0.05; if (done) u.order = null; }
          } else {
            const want = Math.atan2(dy, dx);
            // turn first when the angle is large
            const da = Math.abs(angDiff(want, u.facing));
            u.facing = turnToward(u.facing, want, bt.turn * dt);
            if (da < 1.0 || u.cls === 'cav') {
              moving = true;
              let sp = bt.speed * (FORM_SPEED[u.formation] || 1) * tinfo.speed * this.wx.speed * (1 - u.fatigue / 220);
              u.charging = false;
              const chargeNow = (u.cls === 'cav' && u.order.type === 'attack' && d < 260 && u.fatigue < 75) || (u.order.charge && d < 170 && (u.cls !== 'cav' || u.fatigue < 75));
              if (u.order.type === 'move' && u.order.run) sp *= 1.35;
              if (chargeNow && u.cls === 'cav') { sp *= 1.45; u.charging = true; u.fatigue = Math.min(100, u.fatigue + 2.4 * dt); }
              else if (chargeNow) { sp *= 1.2; u.charging = true; u.fatigue = Math.min(100, u.fatigue + 2 * dt); }
              moveSpeed = sp;
              let nx = u.x + Math.cos(u.facing) * sp * dt, ny = u.y + Math.sin(u.facing) * sp * dt;
              // blocked by enemy body?
              let blocked = false;
              for (const e of en) if (this.gap(u, e, nx, ny) < 1) { blocked = true; break; }
              if (!blocked) { u.x = nx; u.y = ny; }
              else moving = false;
            }
          }
        }
      }
      if (!moving) { u.charging = u.charging && !!melee; }
      if (!u.charging) u._bugled = false;
      else if (!u._bugled && u.cls === 'cav') { u._bugled = true; this.snd('bugle', 3, u.x, u.y); }
      if (u.cls === 'cav' && moving && (u.charging || moveSpeed > bt.speed * 1.3)) {
        u.dustT -= dt; u.hoofT -= dt;
        if (u.dustT <= 0) { u.dustT = 0.1; this.puffs.push({ x: u.x - Math.cos(u.facing) * u.d / 2, y: u.y - Math.sin(u.facing) * u.d / 2 + (rnd() - 0.5) * u.w * 0.6, t: 0, life: 0.9, r: 4 + rnd() * 3, c: 'rgba(190,165,120,', a: 0.5 }); }
        if (u.hoofT <= 0) { u.hoofT = 0.55; this.snd('hooves', 0.5, u.x, u.y); }
      }
      u.mv = moving;
      // cavalry tire fast: galloping and fighting burn stamina, and a spent squadron fights badly
      if (u.cls === 'cav') u.fatigue = clamp(u.fatigue + (moving ? (moveSpeed > bt.speed * 1.3 ? 3.2 : 0.9) * this.wx.fat : melee ? 2.8 : -0.9) * dt, 0, 100);
      else u.fatigue = clamp(u.fatigue + (moving ? (moveSpeed > bt.speed * 1.3 ? 2 : 0.7) * this.wx.fat : melee ? 1.2 : -1.5) * dt, 0, 100);
      // friendly separation
      for (const f of this.units) {
        if (melee || f === u || f.side !== s || f.cls === 'gen' || !this.alive(f) || f.state === 'routing') continue;
        const dx = u.x - f.x, dy = u.y - f.y, d = Math.hypot(dx, dy) || 0.1;
        const gp = this.gap(u, f);
        if (gp < 0 && d < 130) { const push = Math.min(-gp * 0.5, 22 * dt); u.x += (dx / d) * push * 0.5; u.y += (dy / d) * push * 0.5; }
      }
      u.x = clamp(u.x, 5, FW - 5); u.y = clamp(u.y, 5, FH - 5);

      // ---------------- combat
      let firing = false;
      const stationary = !moving || u.formation === 'skirmish';
      if (melee) {
        // melee: face enemy
        u.facing = turnToward(u.facing, Math.atan2(melee.y - u.y, melee.x - u.x), bt.turn * dt * 1.2);
        const ex = this.exposure(melee, u);
        let dps = u.men * bt.melee * u.fireMul * (0.7 + 0.3 * u.morale / 100) * (1 - u.fatigue / 300) * this.stamina(u);
        if (u.cls === 'cav' && u.fatigue > 90) u.morale -= 5 * dt; // horses blown: the squadron loses heart
        if (u.cls === 'art') dps *= 0.5;
        // formation matchups for cavalry in melee
        let vuln = 1;
        if (u.cls === 'cav') vuln = melee.cls === 'cav' ? 1 : melee.cls === 'art' ? 1.8 : (FORM_CAV_VULN[melee.formation] || 1);
        // impact of charge
        if (u.charging && !u.impacted && u.state !== 'routing') {
          u.impacted = true; u.cooldown = 5; this.snd('charge', 1.2, u.x, u.y);
          const shock = u.cls === 'cav' ? (u.type === 'lancer' ? 1.05 : 0.8) : 0.22;
          const tf = melee.state === 'routing' ? 2.2 : 1;
          const instant = u.shockMul * u.men * shock * vuln * tf * (0.6 + 0.4 * u.morale / 100) * (ex > 1 ? 1.25 : 1) * (1 - u.fatigue / 250) * this.stamina(u);
          if (u.cls === 'cav') u.fatigue = Math.min(100, u.fatigue + 14);
          this.damage(melee, instant, u, melee.formation === 'square' ? 0.3 : 1.7 * (ex > 1 ? 1.4 : 1) * (melee.state === 'routing' ? 0 : 1));
          if (melee.cls === 'inf' && melee.formation === 'square' && u.cls === 'cav') this.damage(u, melee.men * 0.06, melee, 1.8);
          else if (u.cls === 'cav' && melee.cls !== 'cav' && melee.cls !== 'art') this.damage(u, melee.men * 0.015, melee, 0.8);
          this.puffs.push({ x: (u.x + melee.x) / 2, y: (u.y + melee.y) / 2, t: 0, life: 1.2, r: 18, c: 'rgba(200,180,140,' });
        }
        this.damage(melee, dps * dt * vuln * ex, u, ex > 1 ? 1.4 : 1);
        u.calm = 0;
        // being hit from behind/flank hurts morale more (handled in damage via ex for attacker)
        firing = true;
        u.state = 'fighting';
        u.fatigue = Math.min(100, u.fatigue + 0.6 * dt);
      } else {
        u.impacted = u.impacted && u.charging;
        if (u.state === 'fighting') u.state = 'idle';
        if (bt.range > 0 && stationary && !u.wantForm && !(u.order && u.order.type === 'move' && u.cls === 'art')) {
          // choose target
          let tgt = u.target;
          if (!tgt || !this.alive(tgt) || Math.hypot(tgt.x - u.x, tgt.y - u.y) > maxRange * 1.02 || (u.order && u.order.type === 'attack' && u.order.target && this.alive(u.order.target) && Math.hypot(u.order.target.x - u.x, u.order.target.y - u.y) <= maxRange)) {
            tgt = null;
            if (u.order && u.order.type === 'attack' && u.order.target && this.alive(u.order.target) && Math.hypot(u.order.target.x - u.x, u.order.target.y - u.y) <= maxRange) tgt = u.order.target;
            else {
              let bd = 1e9;
              for (const e of en) {
                const d = Math.hypot(e.x - u.x, e.y - u.y);
                if (d > maxRange) continue;
                let sc = d;
                if (u.cls === 'art') { if (e.cls === 'art') sc *= 1.3; if (e.formation === 'column' || e.formation === 'square') sc *= 0.75; }
                if (e.state === 'routing') sc *= 1.8;
                if (sc < bd) { bd = sc; tgt = e; }
              }
            }
            u.target = tgt;
          }
          if (tgt && (u.cls !== 'art' || u.calm > 0.8 || !moving)) {
            const d = Math.hypot(tgt.x - u.x, tgt.y - u.y);
            // turn to face target when idle
            if (!u.order || u.order.holdFire) u.facing = turnToward(u.facing, u.cls === 'inf' && u.formation !== 'skirmish' && u.formation !== 'square' ? this.lineFacing(u, tgt) : Math.atan2(tgt.y - u.y, tgt.x - u.x), bt.turn * dt * 0.6);
            const faceOk = Math.abs(angDiff(Math.atan2(tgt.y - u.y, tgt.x - u.x), u.facing)) < 0.9;
            if (faceOk) {
              const tt = this.terrainAt(tgt.x, tgt.y);
              const ex = this.exposure(tgt, u);
              const mor = 0.6 + 0.4 * (u.morale / 100);
              const aura = nearGen ? 1.06 : 1;
              let cas;
              if (u.cls === 'art') {
                const guns = u.men / 80;
                const base = guns * 5.5 * (1 - 0.6 * d / maxRange) * (d < 100 ? 2.2 : 1);
                const vuln = tgt.cls === 'cav' ? 1.1 : tgt.cls === 'art' ? 0.8 : (FORM_ART_VULN[tgt.formation] || 1);
                cas = base * vuln * ex * tt.cover * mor * u.fireMul * aura * this.wx.artFire * (1 - u.fatigue / 300);
              } else {
                const acc = 0.45 + 0.55 * (1 - d / maxRange);
                const vuln = tgt.cls === 'cav' ? 0.95 : tgt.cls === 'art' ? 0.8 : 1;
                cas = u.men * bt.fire * (FORM_FIRE[u.formation] || 1) * acc * vuln * ex * tt.cover * mor * u.fireMul * aura * this.wx.fire * (1 - u.fatigue / 300);
              }
              cas *= FIRE_RATE;
              this.damage(tgt, cas * dt, u, ex > 1 ? 1.35 : 1);
              firing = true;
              u.reload -= dt;
              if (u.reload <= 0) {
                u.reload = u.cls === 'art' ? 5.5 + rnd() * 2 : 4.2 + rnd() * 2.2; // slow, readable volleys
                this.fireVolley(u, tgt);
              }
            }
          }
        }
      }
      if (firing) u.calm = 0; else u.calm += dt;

      // ---------------- morale
      u.morale = Math.min(u.morale, u.baseMorale * (1.05 - u.fatigue / 400));
      if (u.sinceHit > 4 && !melee) {
        let reg = 0.9 + (nearGen ? 1.1 : 0);
        u.morale = Math.min(u.baseMorale * (1.02 - u.fatigue / 400), u.morale + reg * dt);
      }
      const thresh = u.formation === 'square' ? 9 : 18;
      if (u.morale <= thresh && u.state !== 'routing') {
        u.state = 'routing'; u.order = null; u.target = null; u.routT = 0; u.charging = false;
        if (u.formation === 'square' || u.formation === 'column') { u.formation = BT[u.type].forms[0]; u.wantForm = null; [u.w, u.d] = dims(u); }
        this.msg(`${NAP.FACTIONS[u.faction].adj} ${u.name} breaks and runs!`); this.snd('rout', 1.5, u.x, u.y);
        for (const f of this.units) if (f !== u && f.cls !== 'gen' && this.alive(f) && Math.hypot(f.x - u.x, f.y - u.y) < 200) f.morale += f.side === u.side ? -9 : 4;
      }
    }

    nearest(u, list) {
      let b = null, bd = 1e9;
      for (const e of list) { const d = (e.x - u.x) ** 2 + (e.y - u.y) ** 2; if (d < bd) { bd = d; b = e; } }
      return b;
    }

    // ---------------------------------------------------------- AI
    aiThink(s) {
      const my = this.friends(s), en = this.enemies(s);
      if (!my.length || !en.length) return;
      const g = this.general(s);
      const attacker = (s === 0) === this.spec.playerIsAttacker;
      if (this.aiMode === undefined) this.aiMode = {};
      const mode = this.aiMode[s] || (this.aiMode[s] = attacker ? 'attack' : (rnd() < 0.35 ? 'attack' : 'defend'));
      const nearestEnemyDist = (u) => { const e = this.nearest(u, en); return e ? Math.hypot(e.x - u.x, e.y - u.y) : 1e9; };
      const goAttack = mode === 'attack' || this.t > 100 || my.some((u) => nearestEnemyDist(u) < 190) || this.strength(s) < this.strength(1 - s) * 0.7;
      const infFront = my.filter((u) => u.cls === 'inf' && u.state !== 'routing');
      const frontX = infFront.length ? (s === 0 ? Math.max(...infFront.map((u) => u.x)) : Math.min(...infFront.map((u) => u.x))) : (s === 0 ? 400 : 1200);
      // objective play: send units to capture, and keep one unit holding each captured point
      const tasked = new Set();
      if (this.objs && this.objs.length) {
        let cand = my.filter((u) => (u.type === 'light' || u.type === 'militia') && !u.reserve && u.state !== 'routing' && u.formation !== 'square');
        if (!cand.length && mode === 'defend') cand = my.filter((u) => u.cls === 'inf' && !u.reserve && u.state !== 'routing' && u.formation !== 'square').slice(0, 1);
        const quota = mode === 'defend' ? 2 : 1, used = new Set();
        let n = 0;
        const free = this.objs.filter((o) => o.owner !== s).sort((a, b) => Math.abs(a.x - (s === 0 ? 0 : FW)) - Math.abs(b.x - (s === 0 ? 0 : FW)));
        for (const o of free) {
          if (n >= quota) break;
          let best = null, bd = 1e9;
          for (const u of cand) { if (used.has(u)) continue; const dd = Math.hypot(u.x - o.x, u.y - o.y); if (dd < bd) { bd = dd; best = u; } }
          if (!best) continue;
          const e0 = this.nearest(best, en), ed = e0 ? Math.hypot(e0.x - best.x, e0.y - best.y) : 1e9;
          if (ed > 110) {
            used.add(best); tasked.add(best); n++;
            if (!best.order || best.order.type !== 'move' || Math.hypot(best.order.x - o.x, best.order.y - o.y) > 15) best.order = { type: 'move', x: o.x, y: o.y };
            if (best.formation === 'line' && bd > 250 && !best.wantForm) this.setFormation(best, 'column');
            else if (bd < 120 && best.formation === 'column' && !best.wantForm) this.setFormation(best, BT[best.type].forms[0]);
          }
        }
        for (const o of this.objs.filter((q) => q.owner === s)) {
          const inside = cand.filter((u) => Math.hypot(u.x - o.x, u.y - o.y) < o.r).sort((a, b) => b.men - a.men);
          if (inside.length) tasked.add(inside[0]);
        }
      }
      // retreat decision
      const routed = my.filter((u) => u.state === 'routing').length;
      for (const u of my) {
        if (u.state === 'routing') continue;
        if (tasked.has(u)) continue;
        const e = this.nearest(u, en); if (!e) continue;
        const d = Math.hypot(e.x - u.x, e.y - u.y);
        const bt = BT[u.type];
        if (u.cls === 'inf' && u.reserve) {
          const front = my.filter((f) => f.cls === 'inf' && !f.reserve);
          const frontBad = front.some((f) => f.state === 'routing') || front.some((f) => f.men < f.max * 0.5);
          if (this.t > 50 || frontBad || d < 175) { u.reserve = false; }
          else { u.order = null; continue; }
        }
        if (u.cls === 'inf' && u.type === 'light' && goAttack && u.formation !== 'square') {
          const dir = s === 0 ? 1 : -1;
          const cavThreat = en.some((c) => c.cls === 'cav' && c.state !== 'routing' && c.charging && Math.hypot(c.x - u.x, c.y - u.y) < 170);
          if (cavThreat || d < 48) {
            const bx = frontX - dir * 50;
            if (!u.order || u.order.type !== 'move') u.order = { type: 'move', x: bx, y: u.y };
            continue;
          }
          const sx = clamp(frontX + dir * 65, 40, FW - 40);
          if (d > bt.range * 0.9) { if (!u.order || (u.order.type === 'move' && Math.abs(u.order.x - sx) > 20)) u.order = { type: 'move', x: sx, y: clamp(e.y, 80, FH - 80) }; }
          else if (u.order) u.order = null;
          continue;
        }
        if (u.cls === 'inf') {
          // square vs charging cavalry
          const threat = en.find((c) => c.cls === 'cav' && c.state !== 'routing' && Math.hypot(c.x - u.x, c.y - u.y) < 125 && c.charging);
          const infNear = en.some((c) => c.cls === 'inf' && c.state !== 'routing' && Math.hypot(c.x - u.x, c.y - u.y) < 110);
          if (threat && !infNear && u.formation !== 'square' && !u.wantForm) { this.setFormation(u, 'square'); u.order = null; continue; }
          if (u.formation === 'square' && !threat && !en.some((c) => c.cls === 'cav' && c.state !== 'routing' && Math.hypot(c.x - u.x, c.y - u.y) < 190) && !u.wantForm) { this.setFormation(u, bt.forms[0]); }
          if (u.formation === 'square') continue;
          if (!goAttack) {
            if (d > bt.range * 1.2) { if (u.order) u.order = null; }
            continue;
          }
          // choose formation by distance
          const wantF = d > 240 ? (u.type === 'light' ? 'skirmish' : 'column') : (u.type === 'light' ? 'skirmish' : 'line');
          if (u.formation !== wantF && !u.wantForm && !u.order?.charge) {
            if (!(wantF === 'column' && u.formation === 'line' && d < 300)) this.setFormation(u, wantF);
          }
          if (d > bt.range * 0.95) {
            // advance as a straight, parallel line: march along the battle axis, drifting toward the enemy's lane; the regiment halts by itself once an enemy is in range
            const dir = s === 0 ? 1 : -1;
            if (!u.order || u.order.type !== 'move' || this.t % 6 < 0.7) u.order = { type: 'move', x: clamp(u.x + dir * 140, 20, FW - 20), y: clamp(u.y + clamp(e.y - u.y, -45, 45), 40, FH - 40), fa: s === 0 ? 0 : Math.PI };
          } else if (u.order && u.order.type === 'move') { u.order = null; }
          // bayonet charge when the enemy is shaken and close
          if (d < 55 && e.morale < 40 && e.state !== 'routing' && !u.charging && u.morale > 55 && (u.type === 'guard' || rnd() < 0.15)) u.order = { type: 'attack', target: e, charge: true };
          if (u.order && u.order.type === 'attack' && !this.alive(u.order.target)) u.order = null;
        } else if (u.cls === 'art') {
          const inRange = en.some((c) => Math.hypot(c.x - u.x, c.y - u.y) < bt.range * 0.95);
          const inFront = s === 0 ? u.x < frontX + 50 : u.x > frontX - 50;
          if (!inRange && goAttack && inFront) u.order = { type: 'move', x: u.x + (s === 0 ? 70 : -70), y: u.y };
          else if (inRange && u.order && u.order.type === 'move') u.order = null;
          // retire guns in danger
          const close = en.find((c) => c.cls === 'cav' && c.state !== 'routing' && Math.hypot(c.x - u.x, c.y - u.y) < 100);
          if (close && !my.some((f) => f.cls === 'inf' && f.state !== 'routing' && Math.hypot(f.x - u.x, f.y - u.y) < 75) && !(u.order && u.order.type === 'move')) u.order = { type: 'move', x: u.x - (s === 0 ? 1 : -1) * 75, y: u.y };
        } else if (u.cls === 'cav') {
          if (u.cooldown > 0) u.cooldown -= 0.6;
          if (u.order && u.order.type === 'attack' && !this.alive(u.order.target)) u.order = null;
          const engaged = this.t > 25 || my.some((f) => f.cls === 'inf' && nearestEnemyDist(f) < 150);
          if (u.state === 'routing') continue;
          const hurt = u.men < u.max * 0.45;
          if ((u.fatigue > 80 || u.morale < 40 || hurt) && !(u.order && u.order.type === 'attack' && Math.hypot(u.order.target.x - u.x, u.order.target.y - u.y) < 70 && !hurt)) {
            if (!u.order || u.order.type !== 'move') u.order = { type: 'move', x: s === 0 ? 250 : 1350, y: clamp(u.y, 100, FH - 100) };
            continue;
          }
          if (u.order && u.order.type === 'move' && u.fatigue > 35 && !hurt && u.morale >= 40) continue; // still recovering
          if (u.order && u.order.type === 'attack') continue;
          if (u.order && u.order.type === 'move') u.order = null;
          if (!engaged || !goAttack || u.cooldown > 0) continue;
          // pick best charge target
          let best = null, bs = -1;
          for (const c of en) {
            const dd = Math.hypot(c.x - u.x, c.y - u.y);
            if (dd > 520) continue;
            let sc = 400 / (dd + 60);
            if (c.cls === 'art') sc *= 2.2;
            if (c.state === 'routing') sc *= 2.4;
            if (c.formation === 'square') sc *= 0.12;
            if (c.formation === 'column') sc *= 1.4;
            if (c.cls === 'cav') sc *= u.type === 'cuirass' ? 0.9 : 0.5;
            const ex = this.exposure(c, u);
            sc *= ex;
            if (c.cls === 'inf' && ex === 1 && c.formation === 'line') sc *= 0.35;
            if (c.cls === 'inf' && c.morale < 45) sc *= 1.8;
            if (sc > bs) { bs = sc; best = c; }
          }
          if (best && bs > 0.7) { u.order = { type: 'attack', target: best, charge: true }; }
        }
      }
      // general behaviour
      if (g && !g.dead) {
        const cx = my.reduce((a, u) => a + u.x, 0) / my.length, cy = my.reduce((a, u) => a + u.y, 0) / my.length;
        const gx = cx - (s === 0 ? 1 : -1) * 90;
        if (Math.hypot(g.x - gx, g.y - cy) > 60) g.order = { type: 'move', x: gx, y: cy };
        if (s === 1 || this.spec.aiBothSides) this.tryRally(s);
      }
      // total panic
      if (routed > my.length * 0.65 && s === 1) for (const u of my) if (u.state !== 'routing' && u.morale < 45) u.morale -= 6;
    }

    setFormation(u, f) {
      if (!BT[u.type].forms.includes(f) || u.formation === f || u.wantForm === f) return;
      if (this.deployPhase && u.side === 0) { u.formation = f; [u.w, u.d] = dims(u); return; }
      u.wantForm = f; u.formT = 2.4 + (u.cls === 'inf' ? 0 : 1);
    }

    tryRally(s) {
      const g = this.general(s);
      if (!g || g.dead || this.rallyCd[s] > 0) return false;
      let n = 0;
      for (const u of this.units) {
        if (u.side === s && u.cls !== 'gen' && this.alive(u) && u.state === 'routing' && Math.hypot(u.x - g.x, u.y - g.y) < 280) {
          u.morale = Math.max(u.morale, 48); u.state = 'idle'; u.order = null; u.routT = 0; n++;
        }
      }
      if (n) { this.rallyCd[s] = this.rallyBase[s]; this.msg(`${g.name} rallies ${n} unit${n > 1 ? 's' : ''}!`); return true; }
      return false;
    }

    // ---------------------------------------------------------- end of battle
    checkEnd() {
      if (this.over) return;
      const s0 = this.strength(0), s1 = this.strength(1);
      const t0 = this.totalMen(0), t1 = this.totalMen(1);
      const broken = (side, str, tot, init) => str < init * 0.12 || tot <= 0 || this.friends(side).every((u) => u.state === 'routing');
      let winner = null;
      const b0 = broken(0, s0, t0, this.initialMen[0]), b1 = broken(1, s1, t1, this.initialMen[1]);
      if (b0 && b1) winner = s0 >= s1 ? 0 : 1;
      else if (b0) winner = 1; else if (b1) winner = 0;
      else if (this.holdT[0] >= 75) { winner = 0; this.endReason = 'Your army held every objective'; }
      else if (this.holdT[1] >= 75) { winner = 1; this.endReason = 'The enemy held every objective'; }
      else if (this.t > this.timeLimit) {
        const dv = this.vp[0] - this.vp[1];
        if (Math.abs(dv) >= 25) { winner = dv > 0 ? 0 : 1; this.endReason = 'Decided on objectives at ' + (this.spec.tod === 'dusk' ? 'nightfall' : 'the time limit'); }
        else { winner = s0 >= s1 ? 0 : 1; this.endReason = 'Decided on strength at ' + (this.spec.tod === 'dusk' ? 'nightfall' : 'the time limit'); }
      }
      if (this.forced !== undefined) winner = this.forced;
      if (winner !== null) this.finish(winner);
    }

    finish(winner) {
      this.record();
      if (NAP.audio) NAP.audio.sfx(winner === 0 ? 'fanfare' : 'defeat');
      this.over = true; this.paused = true; this.winner = winner;
      const loser = 1 - winner;
      const casualties = [0, 0];
      const units = [];
      for (const u of this.units) {
        if (u.cls === 'gen') continue;
        let men = u.dead ? 0 : Math.round(u.men);
        if (!u.dead && u.state === 'routing') men = Math.round(men * 0.8);
        if (u.fled) men = Math.round(men * 0.75);
        if (u.side === loser) men = Math.round(men * 0.88);
        (this.report = this.report || []).push({ side: u.side, name: NAP.UNITS[u.type].name, type: u.type, start: u.start, end: men, kills: Math.round(u.kills), status: u.dead ? 'Destroyed' : u.fled ? 'Fled' : u.state === 'routing' ? 'Routed' : men < u.start * 0.5 ? 'Battered' : 'Intact' });
        casualties[u.side] += Math.max(0, u.ref.men - men);
        u.ref.men = men;
        units.push({ ref: u.ref, men });
      }
      this.result = { winner, units, deadGenerals: this.deadGen.filter((x) => x), casualties };
      // generals of the losing side may be captured/killed
      this.showEnd(winner, casualties);
    }

    // ---------------------------------------------------------- orders (player)
    // During deployment orders place units instantly inside the player's zone.
    deployPlace(u, o) {
      u.x = clamp(o.x, 30, this.zoneR); u.y = clamp(o.y, 30, FH - 30);
      for (const k of this.terrain.rocks) { const dx = u.x - k.x, dy = u.y - k.y, d = Math.hypot(dx, dy) || 1; if (d < k.r + 12) { u.x = clamp(k.x + dx / d * (k.r + 12), 30, this.zoneR); u.y = clamp(k.y + dy / d * (k.r + 12), 30, FH - 30); } }
      if (o.fa !== undefined) u.facing = o.fa;
      u.order = null; u.target = null;
    }
    selectedUnits() { return [...this.sel].filter((u) => this.alive(u) || u.cls === 'gen'); }
    orderMove(units, x, y, run) {
      const us = units.filter((u) => u.cls !== 'gen' && this.alive(u));
      const gens = units.filter((u) => u.cls === 'gen');
      // keep relative offsets around group centroid
      if (us.length) {
        const cx = us.reduce((a, u) => a + u.x, 0) / us.length, cy = us.reduce((a, u) => a + u.y, 0) / us.length;
        us.forEach((u) => {
          if (u.state === 'routing') return;
          const o = { type: 'move', x: clamp(x + (u.x - cx), 10, FW - 10), y: clamp(y + (u.y - cy), 10, FH - 10), run: !!run };
          if (this.deployPhase) this.deployPlace(u, o); else { u.order = o; u.target = null; }
        });
      }
      gens.forEach((g) => { if (this.deployPhase) { g.x = clamp(x, 30, this.zoneR); g.y = clamp(y, 30, FH - 30); } else g.order = { type: 'move', x, y }; });
    }
    orderLine(units, p0, p1) {
      const us = units.filter((u) => u.cls !== 'gen' && this.alive(u) && u.state !== 'routing');
      if (!us.length) return;
      // sort along the line to minimise crossing
      const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy) || 1;
      us.sort((a, b) => ((a.x - p0.x) * dx + (a.y - p0.y) * dy) - ((b.x - p0.x) * dx + (b.y - p0.y) * dy));
      // facing: perpendicular pointing toward enemy
      const ex = this.enemies(us[0].side);
      const ecx = ex.length ? ex.reduce((a, u) => a + u.x, 0) / ex.length : (us[0].side === 0 ? FW : 0);
      const ecy = ex.length ? ex.reduce((a, u) => a + u.y, 0) / ex.length : FH / 2;
      let nx = -dy / len, ny = dx / len;
      if ((ecx - (p0.x + dx / 2)) * nx + (ecy - (p0.y + dy / 2)) * ny < 0) { nx = -nx; ny = -ny; }
      const fa = Math.atan2(ny, nx);
      us.forEach((u, i) => {
        const t = us.length === 1 ? 0.5 : i / (us.length - 1);
        const o = { type: 'move', x: clamp(p0.x + dx * t, 10, FW - 10), y: clamp(p0.y + dy * t, 10, FH - 10), fa };
        if (this.deployPhase) this.deployPlace(u, o); else { u.order = o; u.target = null; }
      });
    }
    orderAttack(units, target, charge) {
      if (this.deployPhase) return;
      units.forEach((u) => {
        if (u.cls === 'gen' || !this.alive(u) || u.state === 'routing') return;
        if (u.type === 'art') { u.order = null; u.target = target; return; }
        u.order = { type: 'attack', target, charge: !!charge || u.cls === 'cav' };
        if (u.cls === 'inf' && charge && u.formation === 'square') this.setFormation(u, BT[u.type].forms[0]);
        if (u.cls === 'inf' && !charge && u.formation === 'line' && Math.hypot(target.x - u.x, target.y - u.y) > 260) this.setFormation(u, 'column');
      });
    }

    // ---------------------------------------------------------- rendering
    resize() {
      const c = this.canvas; if (!c) return;
      const r = this.stage.getBoundingClientRect();
      c.width = Math.max(300, r.width * devicePixelRatio); c.height = Math.max(200, r.height * devicePixelRatio);
      this.fit = Math.min(c.width / FW, c.height / FH) * 0.98;
    }
    toWorld(px, py) {
      const k = this.fit * this.cam.z * 1; const c = this.canvas;
      return { x: (px * devicePixelRatio - c.width / 2) / k + this.cam.x, y: (py * devicePixelRatio - c.height / 2) / k + this.cam.y };
    }

    prerender() {
      const S = 1.5;
      const cv = document.createElement('canvas'); cv.width = FW * S; cv.height = FH * S;
      const ctx = cv.getContext('2d'); ctx.scale(S, S);
      const T = this.terrain;
      // ground
      ctx.fillStyle = T.base; ctx.fillRect(0, 0, FW, FH);
      for (const n of T.noise) { ctx.fillStyle = `rgba(${n[3] > 0.5 ? '255,255,220' : '40,60,20'},0.045)`; ctx.beginPath(); ctx.arc(n[0], n[1], n[2], 0, TAU); ctx.fill(); }
      for (const h of T.hills) {
        const g = ctx.createRadialGradient(h.x, h.y, 4, h.x, h.y, h.r);
        g.addColorStop(0, 'rgba(235,225,170,0.55)'); g.addColorStop(0.6, 'rgba(210,200,140,0.3)'); g.addColorStop(1, 'rgba(160,150,100,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(120,100,60,0.35)'; ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(h.x, h.y, h.r * i / 4, 0, TAU); ctx.stroke(); }
      }
      for (const f of T.forests) {
        ctx.fillStyle = 'rgba(40,80,40,0.35)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, TAU); ctx.fill();
        for (const t of f.trees) { ctx.fillStyle = '#2f6a35'; ctx.beginPath(); ctx.arc(f.x + t[0] * f.rx, f.y + t[1] * f.ry, t[2], 0, TAU); ctx.fill(); ctx.fillStyle = '#3d8244'; ctx.beginPath(); ctx.arc(f.x + t[0] * f.rx - 2, f.y + t[1] * f.ry - 2, t[2] * 0.6, 0, TAU); ctx.fill(); }
      }
      for (const v of T.villages) this.drawVillage(ctx, v);
      for (const r of T.rocks) { ctx.fillStyle = '#7d786c'; ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = r.a + i * TAU / 7, rr = r.r * (0.75 + 0.25 * ((i * 7) % 3) / 2); ctx.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#4a463d'; ctx.stroke(); }
      for (const w of T.works) {
        ctx.fillStyle = '#8a8478'; ctx.fillRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);
        ctx.fillStyle = '#5b574d'; for (let yy = w.y - w.h / 2; yy < w.y + w.h / 2 - 4; yy += 8) ctx.fillRect(w.x - w.w / 2, yy, 8, 4);
        ctx.strokeStyle = '#3a372f'; ctx.lineWidth = 1.5; ctx.strokeRect(w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);
      }
      this.terrainCanvas = cv;
    }

    draw() {
      const c = this.canvas, ctx = this.ctx;
      const k = this.fit * this.cam.z;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#2b3a22'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.translate(c.width / 2 - this.cam.x * k, c.height / 2 - this.cam.y * k);
      ctx.scale(k, k);
      ctx.drawImage(this.terrainCanvas, 0, 0, FW, FH);
      if (this.deployPhase) {
        const zr = this.zoneR;
        ctx.fillStyle = 'rgba(60,110,230,0.13)'; ctx.fillRect(0, 0, zr, FH);
        ctx.fillStyle = 'rgba(210,70,70,0.08)'; ctx.fillRect(this.zoneL, 0, FW - this.zoneL, FH);
        ctx.strokeStyle = 'rgba(120,170,255,0.7)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(zr, 0); ctx.lineTo(zr, FH); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,130,130,0.5)'; ctx.beginPath(); ctx.moveTo(this.zoneL, 0); ctx.lineTo(this.zoneL, FH); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(200,220,255,0.85)'; ctx.font = 'bold 18px "IM Fell English", Georgia, serif'; ctx.textAlign = 'center';
        ctx.fillText('YOUR DEPLOYMENT ZONE', zr / 2, 36);
        ctx.fillStyle = 'rgba(255,200,200,0.7)'; ctx.fillText('ENEMY ZONE', (this.zoneL + FW) / 2, 36);
      }
      // fallen
      for (const d of this.dead) { ctx.fillStyle = d[2] === 0 ? 'rgba(30,50,110,0.38)' : 'rgba(120,40,40,0.38)'; ctx.fillRect(d[0], d[1], 1.6, 1.6); }
      // objectives, flank arcs and order markers (under the units)
      this.drawObjectives(ctx);
      this.drawOverlays(ctx);
      // terrain captions: constant on-screen size, drawn under the units
      { const sk0 = this.fit * this.cam.z, fs = clamp(12 * devicePixelRatio / sk0, 5, 26);
        if (sk0 > 0.3) { ctx.font = `italic 600 ${fs}px "IM Fell English", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = fs / 4; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          for (const c of this.terrain.caps) { ctx.fillStyle = c.c; ctx.strokeText(c.t, c.x, c.y); ctx.fillText(c.t, c.x, c.y); } } }
      // units (routing first so living units draw on top)
      const sorted = this.units.filter((u) => !u.fled && (u.cls === 'gen' ? !u.dead : !u.dead)).sort((a, b) => (a.state === 'routing' ? 0 : 1) - (b.state === 'routing' ? 0 : 1));
      const fog = (this.spec.weather === 'fog') && !this.replay && !this.over;
      const mine = fog ? this.units.filter((m) => m.side === 0 && this.alive(m)) : null;
      for (const u of sorted) {
        if (fog && u.side === 1 && !mine.some((m) => Math.hypot(m.x - u.x, m.y - u.y) < 400)) continue;
        this.drawUnit(ctx, u);
      }
      // aim dashes from the muzzle toward the target
      ctx.setLineDash([3, 5]); ctx.lineWidth = 0.9;
      for (const sh of this.shots) { const al = 0.5 * (1 - sh.t / 0.7); ctx.strokeStyle = sh.art ? `rgba(255,200,120,${al})` : `rgba(255,240,170,${al})`; ctx.beginPath(); ctx.moveTo(sh.x0, sh.y0); ctx.lineTo(sh.x1, sh.y1); ctx.stroke(); }
      ctx.setLineDash([]);
      // bullets (bright dashes) and round shot (dark ball with trail)
      for (const p of this.proj) {
        if (p.t < p.delay) continue;
        const f = (p.t - p.delay) / p.dur; if (f > 1) continue;
        const dx = p.x1 - p.x0, dy = p.y1 - p.y0, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        const x = p.x0 + dx * f, y = p.y0 + dy * f;
        if (p.kind === 'bullet') {
          ctx.strokeStyle = 'rgba(255,240,170,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - ux * 26, y - uy * 26); ctx.lineTo(x, y); ctx.stroke();
          ctx.strokeStyle = 'rgba(255,250,215,0.98)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - ux * 9, y - uy * 9); ctx.lineTo(x, y); ctx.stroke();
        } else {
          ctx.strokeStyle = 'rgba(255,210,150,0.28)'; ctx.setLineDash([2, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x0, p.y0); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
          for (let i = 1; i <= 5; i++) { ctx.fillStyle = `rgba(40,40,40,${0.5 - i * 0.08})`; ctx.beginPath(); ctx.arc(x - ux * i * 5, y - uy * i * 5, 2.2 - i * 0.15, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#16140f'; ctx.beginPath(); ctx.arc(x, y, 2.8, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,230,180,0.8)'; ctx.lineWidth = 0.7; ctx.stroke();
        }
      }
      for (const q of this.sparks) { ctx.fillStyle = `rgba(70,50,30,${1 - q.t / q.life})`; ctx.fillRect(q.x - 1, q.y - 1, 2, 2); }
      // smoke
      for (const p of this.puffs) { if (p.t < 0) continue; const f = p.t / p.life; ctx.fillStyle = p.c + ((p.a || 0.55) * (1 - f)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(p.x + (p.nd ? 0 : f * 6), p.y - (p.nd ? 0 : f * 8), p.r * (p.nd ? 0.8 + 0.5 * f : 0.6 + f), 0, TAU); ctx.fill(); }
      // casualty floaters
      { const fs = clamp(11 * devicePixelRatio / k, 5, 20); ctx.font = `bold ${fs}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = fs / 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        for (const f of this.floaters) { const a = 1 - f.t / 1.6; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = f.side === 0 ? '#ff8a8a' : '#ffd36a'; const yy = f.y - f.t * 22; ctx.strokeText(f.txt, f.x, yy); ctx.fillText(f.txt, f.x, yy); } ctx.globalAlpha = 1; }
      // selection box
      if (this.box) {
        const a = this.toWorld(this.box.x0, this.box.y0), b = this.toWorld(this.box.x1, this.box.y1);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1 / k; ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      }
      if (this.lineDrag) {
        ctx.strokeStyle = 'rgba(120,200,255,0.95)'; ctx.lineWidth = 3 / k;
        ctx.beginPath(); ctx.moveTo(this.lineDrag.p0.x, this.lineDrag.p0.y); ctx.lineTo(this.lineDrag.p1.x, this.lineDrag.p1.y); ctx.stroke();
      }
      // field border
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, FW, FH);
      this.drawWeather(ctx);
    }

    drawObjectives(ctx) {
      const sk = this.fit * this.cam.z, fs = clamp(11 * devicePixelRatio / sk, 5, 24);
      for (const o of this.objs || []) {
        const col = o.owner === 0 ? '60,130,255' : o.owner === 1 ? '230,70,70' : '235,235,235';
        ctx.save();
        ctx.setLineDash([9, 7]); ctx.lineWidth = 2 / Math.max(0.5, sk) * devicePixelRatio; ctx.strokeStyle = `rgba(${col},0.75)`; ctx.fillStyle = `rgba(${col},0.07)`;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        // capture progress arc (blue grows for you, red for the enemy)
        if (Math.abs(o.c) > 0.02) {
          ctx.lineWidth = 5 / Math.max(0.5, sk) * devicePixelRatio; ctx.strokeStyle = o.c < 0 ? 'rgba(80,150,255,0.9)' : 'rgba(240,80,80,0.9)';
          ctx.beginPath(); ctx.arc(o.x, o.y, o.r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * Math.abs(o.c)); ctx.stroke();
        }
        // flagpole
        ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(o.x, o.y + 6); ctx.lineTo(o.x, o.y - 22); ctx.stroke();
        ctx.fillStyle = `rgb(${col})`; const wv = Math.sin(this.t * 3 + o.x) * 2;
        ctx.beginPath(); ctx.moveTo(o.x, o.y - 22); ctx.lineTo(o.x + 16, o.y - 18 + wv); ctx.lineTo(o.x, o.y - 12); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.font = `bold ${fs}px "IM Fell English", Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = fs / 4; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.fillStyle = '#fff';
        ctx.strokeText(o.name, o.x, o.y + o.r + fs); ctx.fillText(o.name, o.x, o.y + o.r + fs);
        ctx.restore();
      }
    }

    // flank arcs for selected / hovered unit; order lines and markers for the selection
    drawOverlays(ctx) {
      const sk = this.fit * this.cam.z, lw = 1.4 * devicePixelRatio / Math.max(0.5, sk);
      // range cones: how far each regiment can shoot (cavalry: charge reach), drawn faintly for everyone
      if (this.showRange !== false) {
        const fog = this.spec.weather === 'fog' && !this.over && !this.replay, mine = fog ? this.units.filter((m) => m.side === 0 && this.alive(m)) : null;
        for (const u of this.units) {
          if (u.cls === 'gen' || u.dead || u.fled || u.state === 'routing' || !this.alive(u)) continue;
          if (fog && u.side === 1 && !mine.some((m) => Math.hypot(m.x - u.x, m.y - u.y) < 400)) continue;
          const bt = BT[u.type], rng = bt.range || 150, ha = u.cls === 'art' ? 0.5 : u.formation === 'square' ? Math.PI : u.formation === 'skirmish' ? 0.9 : 0.62, r0 = Math.max(u.w, u.d) / 2 - 2;
          const col = u.side === 0 ? '90,160,255' : '255,100,100', sel = this.sel.has(u) || u === this.hoverUnit;
          ctx.save(); ctx.translate(u.x, u.y);
          ctx.fillStyle = `rgba(${col},${sel ? 0.14 : 0.07})`; ctx.strokeStyle = `rgba(${col},${sel ? 0.7 : 0.38})`; ctx.lineWidth = lw; if (!bt.range) ctx.setLineDash([5, 5]);
          ctx.beginPath(); if (ha >= Math.PI) { ctx.arc(0, 0, rng, 0, TAU); } else { ctx.moveTo(Math.cos(u.facing - ha) * r0, Math.sin(u.facing - ha) * r0); ctx.arc(0, 0, rng, u.facing - ha, u.facing + ha); ctx.lineTo(Math.cos(u.facing + ha) * r0, Math.sin(u.facing + ha) * r0); ctx.closePath(); }
          ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
        }
      }
      const arcs = [...this.sel].filter((u) => u.cls !== 'gen' && this.alive(u)).slice(0, 6);
      const hu = this.hoverUnit; if (hu && hu.cls !== 'gen' && this.alive(hu) && !arcs.includes(hu)) arcs.push(hu);
      for (const u of arcs) {
        const rad = Math.max(u.w, u.d) / 2 + 26, f = u.facing;
        ctx.save(); ctx.translate(u.x, u.y);
        if (u.formation === 'square' || u.formation === 'skirmish' || u.cls === 'art') {
          ctx.strokeStyle = 'rgba(120,230,120,0.4)'; ctx.lineWidth = lw; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        } else {
          const A = 1.05, seg = (a0, a1, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rad, a0, a1); ctx.closePath(); ctx.fill(); };
          seg(f - A, f + A, 'rgba(90,220,110,0.13)');
          seg(f + A, f + Math.PI - A, 'rgba(240,210,70,0.16)'); seg(f - Math.PI + A, f - A, 'rgba(240,210,70,0.16)');
          seg(f + Math.PI - A, f + Math.PI + A, 'rgba(240,70,70,0.2)');
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = lw; ctx.beginPath();
          for (const a of [f + A, f - A, f + Math.PI - A, f - Math.PI + A]) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } ctx.stroke();
        }
        ctx.restore();
      }
      ctx.lineWidth = lw; 
      for (const u of this.sel) {
        const o = u.order; if (!u.x || u.dead || u.fled) continue;
        if (o && o.type === 'move') {
          ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.y - 14); ctx.stroke();
          ctx.fillStyle = '#7cf'; ctx.beginPath(); ctx.moveTo(o.x, o.y - 14); ctx.lineTo(o.x + 9, o.y - 11); ctx.lineTo(o.x, o.y - 8); ctx.closePath(); ctx.fill();
          if (o.fa !== undefined) { ctx.strokeStyle = '#7cf'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + Math.cos(o.fa) * 22, o.y + Math.sin(o.fa) * 22); ctx.stroke(); }
        } else if (o && o.type === 'attack' && o.target && this.alive(o.target)) {
          ctx.strokeStyle = 'rgba(255,70,70,0.85)'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(o.target.x, o.target.y); ctx.stroke(); ctx.setLineDash([]);
          ctx.beginPath(); ctx.arc(o.target.x, o.target.y, Math.max(o.target.w, o.target.d) / 2 + 8, 0, TAU); ctx.stroke();
        } else if (u.target && this.alive(u.target) && u.cls !== 'gen') {
          ctx.strokeStyle = 'rgba(255,170,90,0.4)'; ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.target.x, u.target.y); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    }

    stamina(u) { return u.cls === 'cav' ? clamp(1.25 - u.fatigue / 80, 0.1, 1) : 1; }
    // A line keeps its shape: infantry face the middle of the enemy in reach (not one regiment each) and keep step with idle neighbours.
    lineFacing(u, tgt) {
      let ax = 0, ay = 0, n = 0;
      for (const e of this.units) if (e.side !== u.side && e.cls !== 'gen' && this.alive(e) && e.state !== 'routing' && Math.hypot(e.x - u.x, e.y - u.y) < 300) { ax += e.x; ay += e.y; n++; }
      const want = n ? Math.atan2(ay / n - u.y, ax / n - u.x) : Math.atan2(tgt.y - u.y, tgt.x - u.x);
      // keep the chosen target inside the firing arc
      const toT = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      let sx = Math.cos(want), sy = Math.sin(want);
      for (const f of this.units) if (f !== u && f.side === u.side && f.cls === 'inf' && !f.order && f.state !== 'routing' && f.state !== 'fighting' && this.alive(f) && Math.hypot(f.x - u.x, f.y - u.y) < 170) { sx += Math.cos(f.facing) * 0.9; sy += Math.sin(f.facing) * 0.9; }
      const a = Math.atan2(sy, sx);
      return Math.abs(angDiff(toT, a)) < 0.7 ? a : toT;
    }
    // A readable village: dirt road, cottages with pitched tiled roofs, a church, walled gardens and crop fields
    drawVillage(ctx, v) {
      ctx.save(); ctx.translate(v.x, v.y);
      for (const f of v.fields) { // crop strips
        const [fx, fy, fw, fh, kind] = f; ctx.fillStyle = ['rgba(212,190,98,0.75)', 'rgba(120,160,70,0.7)', 'rgba(170,140,90,0.7)'][kind]; ctx.fillRect(fx - fw / 2, fy - fh / 2, fw, fh);
        ctx.strokeStyle = 'rgba(70,55,25,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); for (let yy = fy - fh / 2 + 4; yy < fy + fh / 2; yy += 4.5) { ctx.moveTo(fx - fw / 2, yy); ctx.lineTo(fx + fw / 2, yy); } ctx.stroke();
        ctx.strokeStyle = 'rgba(80,60,30,0.7)'; ctx.strokeRect(fx - fw / 2, fy - fh / 2, fw, fh);
      }
      ctx.fillStyle = 'rgba(165,135,90,0.4)'; ctx.beginPath(); ctx.ellipse(0, 0, 78, 44, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b79c6a'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-82, 0); ctx.lineTo(82, 0); ctx.stroke();
      ctx.strokeStyle = '#d6c294'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-82, 0); ctx.lineTo(82, 0); ctx.stroke(); ctx.lineCap = 'butt';
      for (const h of v.hs) {
        const [hx, hy, hw, hh, alt] = h;
        // garden fence
        ctx.strokeStyle = 'rgba(90,65,35,0.7)'; ctx.setLineDash([2, 2]); ctx.lineWidth = 1; ctx.strokeRect(hx - hw / 2 - 4, hy - hh / 2 - 4, hw + 8, hh + 8); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(hx - hw / 2 + 2.5, hy - hh / 2 + 3.5, hw, hh);       // shadow
        ctx.fillStyle = '#efe4c8'; ctx.fillRect(hx - hw / 2, hy - hh / 2, hw, hh);                           // walls
        ctx.strokeStyle = '#6d5a3a'; ctx.lineWidth = 1; ctx.strokeRect(hx - hw / 2, hy - hh / 2, hw, hh);
        const rc = alt ? ['#b8472e', '#97351f'] : ['#a0663a', '#7e4c28'];
        ctx.fillStyle = rc[0]; ctx.fillRect(hx - hw / 2 + 1, hy - hh / 2 + 1, hw - 2, hh / 2 - 0.5);       // roof, lit side
        ctx.fillStyle = rc[1]; ctx.fillRect(hx - hw / 2 + 1, hy, hw - 2, hh / 2 - 1);                         // roof, shaded side
        ctx.strokeStyle = 'rgba(40,20,10,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx - hw / 2 + 1, hy); ctx.lineTo(hx + hw / 2 - 1, hy); ctx.stroke(); // ridge
        ctx.fillStyle = '#5a5a58'; ctx.fillRect(hx + hw / 2 - 5, hy - hh / 2 + 2, 3, 3);                       // chimney
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(hx - 1.5, hy + hh / 2 - 1, 3, 2);                             // door
      }
      // church
      const c = v.church;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(c.x - 12 + 3, c.y - 8 + 3, 26, 17);
      ctx.fillStyle = '#d8d2c2'; ctx.fillRect(c.x - 13, c.y - 8, 26, 16); ctx.strokeStyle = '#4a4a46'; ctx.lineWidth = 1; ctx.strokeRect(c.x - 13, c.y - 8, 26, 16);
      ctx.fillStyle = '#5d6670'; ctx.fillRect(c.x - 12, c.y - 7, 24, 14); ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(c.x - 12, c.y); ctx.lineTo(c.x + 12, c.y); ctx.stroke();
      ctx.fillStyle = '#c9c2b0'; ctx.fillRect(c.x - 20, c.y - 5, 9, 10); ctx.strokeRect(c.x - 20, c.y - 5, 9, 10);       // tower
      ctx.fillStyle = '#3f464e'; ctx.beginPath(); ctx.moveTo(c.x - 20, c.y - 5); ctx.lineTo(c.x - 11, c.y - 5); ctx.lineTo(c.x - 15.5, c.y + 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(c.x - 15.5, c.y - 11); ctx.lineTo(c.x - 15.5, c.y - 5); ctx.moveTo(c.x - 18, c.y - 8.5); ctx.lineTo(c.x - 13, c.y - 8.5); ctx.stroke(); // cross
      ctx.restore();
    }

    drawWeather(ctx) {
      const W = this.spec.weather || 'clear', tod = this.spec.tod || 'day', tt = this.t;
      if (tod === 'dawn') { ctx.fillStyle = 'rgba(255,170,90,0.10)'; ctx.fillRect(0, 0, FW, FH); }
      if (tod === 'dusk') { const f = Math.min(1, this.t / 420); ctx.fillStyle = `rgba(190,90,40,${0.10 + 0.22 * f})`; ctx.fillRect(0, 0, FW, FH); }
      if (W === 'fog') { ctx.fillStyle = 'rgba(205,215,225,0.28)'; ctx.fillRect(0, 0, FW, FH); }
      if (W === 'rain') {
        ctx.strokeStyle = 'rgba(190,210,235,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i < 170; i++) { const x = (i * 97 + tt * 140) % FW, y = (i * 53 + tt * 520) % FH; ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 14); }
        ctx.stroke(); ctx.fillStyle = 'rgba(60,80,110,0.12)'; ctx.fillRect(0, 0, FW, FH);
      }
      if (W === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        for (let i = 0; i < 160; i++) { const x = (i * 131 + Math.sin(tt + i) * 20 + tt * 14) % FW, y = (i * 71 + tt * 60) % FH; ctx.fillRect(x, y, 2.2, 2.2); }
        ctx.fillStyle = 'rgba(230,240,255,0.14)'; ctx.fillRect(0, 0, FW, FH);
      }
    }

    keys4(u) {
      if (!u._k) {
        let sd = (u.id * 7919 + 13) >>> 0; const rn = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
        u._k = Array.from({ length: 130 }, () => [rn(), rn(), rn(), rn()]);
      }
      return u._k;
    }

    // Individual soldiers: the block thins out, shrinks and frays as men fall
    drawFigures(ctx, u, w, d, fc, sk, r, sel, wh) {
      const K = this.keys4(u), form = u.formation, moraleF = clamp(u.morale / u.baseMorale, 0, 1), routing = u.state === 'routing';
      const wob = (routing ? 1.6 : 0) + (1 - moraleF) * 1.1;          // nervous shuffling
      const frayed = (1 - r) * 3.2 + (1 - moraleF) * 1.4 + (routing ? 2.5 : 0); // looseness of the ranks
      const detail = sk > 2.2;
      // faint hull so the unit still reads as one body (fades as it dies)
      ctx.fillStyle = tint(fc.color, wh); ctx.globalAlpha *= 0.16 + 0.14 * r + 0.25 * wh;
      ctx.fillRect(-d / 2, -w / 2, d, w); ctx.globalAlpha = u.state === 'routing' ? 0.82 : 1;
      if (wh > 0) { // white halo: pulses while locked in melee, solid once broken (readable on pale nations too)
        ctx.save(); ctx.globalAlpha = Math.min(1, 0.25 + wh * 0.9); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6 + wh * 2.4; ctx.shadowColor = '#fff'; ctx.shadowBlur = 6 + wh * 10;
        ctx.strokeRect(-d / 2 - 2.5, -w / 2 - 2.5, d + 5, w + 5); ctx.restore();
      }
      if (u.cls === 'art') { this.drawGuns(ctx, u, w, d, fc, K, r, detail); }
      else {
        const per = u.cls === 'cav' ? 10 : 16, maxF = u.cls === 'cav' ? 26 : 50;
        const nVis = clamp(Math.ceil(u.men / per), 1, maxF);
        const nSlots = Math.min(130, Math.ceil(nVis * (1 + 0.65 * (1 - r))));
        const ranks = form === 'column' ? Math.max(4, Math.ceil(nSlots / 3)) : form === 'square' ? Math.ceil(Math.sqrt(nSlots)) : form === 'skirmish' ? 0 : u.cls === 'cav' ? 2 : nSlots > 34 ? 3 : 2;
        const cols = ranks ? Math.ceil(nSlots / ranks) : 0;
        const keep = nVis / nSlots;
        const fs = u.cls === 'cav' ? 3.6 : 2.6;
        const t = this.t;
        for (let j = 0; j < nSlots; j++) {
          const k = K[j];
          if (k[0] > keep) continue; // fallen / missing
          let x, y, rk = 0;
          if (ranks) {
            rk = Math.floor(j / cols); const cl = j % cols;
            x = -d / 2 + (rk + 0.5) / ranks * d + (k[1] - 0.5) * frayed * 0.9;
            y = -w / 2 + (cl + 0.5) / cols * w + (k[2] - 0.5) * frayed;
          } else { x = -d / 2 + k[1] * d; y = -w / 2 + k[2] * w; }
          if (wob > 0.05) { x += Math.sin(t * 4 + j * 1.7) * wob * 0.5; y += Math.cos(t * 3.3 + j * 2.1) * wob * 0.5; }
          // life in the ranks: marching step, firing recoil, melee lunges
          const age = t - (u.volleyT === undefined ? -9 : u.volleyT);
          if (u.mv && !routing) { const ph = t * (u.cls === 'cav' ? 11 : 6.5) + j * 1.9; x += Math.sin(ph) * (u.cls === 'cav' ? 0.9 : 0.45); y -= Math.abs(Math.sin(ph)) * (u.cls === 'cav' ? 0.8 : 0.45); }
          if (u.state === 'fighting') { x += Math.sin(t * 9 + j * 2.3) * 1.2; y += Math.cos(t * 7 + j * 1.1) * 0.6; }
          else if (age >= 0 && age < 0.45) {
            x -= (1 - age / 0.45) * 1.3;
            const fr = ranks ? rk === ranks - 1 : true, fa = age - K[j][2] * 0.4;
            if (fr && fa >= 0 && fa < 0.12) { ctx.fillStyle = 'rgba(255,232,150,0.95)'; ctx.beginPath(); ctx.arc(x + fs + 1.4, y, 1.6, 0, TAU); ctx.fill(); }
          }
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          if (u.cls === 'cav') ctx.fillRect(x - fs * 0.9, y - fs * 0.5, fs * 1.8 + 0.8, fs + 0.8); else ctx.fillRect(x - fs / 2 - 0.4, y - fs / 2 - 0.4, fs + 0.8, fs + 0.8);
          ctx.fillStyle = tint(k[3] < 0.1 && r < 0.6 ? '#505050' : fc.color, wh); // some men already look worn
          if (u.cls === 'cav') ctx.fillRect(x - fs * 0.9, y - fs * 0.5, fs * 1.8, fs); else ctx.fillRect(x - fs / 2, y - fs / 2, fs, fs);
          if (detail) {
            ctx.fillStyle = u.type === 'guard' ? '#f0c040' : '#e8e0d0'; ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
            ctx.strokeStyle = 'rgba(30,30,30,0.9)'; ctx.lineWidth = 0.35; ctx.beginPath(); ctx.moveTo(x + 0.4, y); ctx.lineTo(x + (u.cls === 'cav' ? 4.2 : 3.4), y); ctx.stroke();
          }
        }
      }
      // standard-bearer at the front centre (lost with the regiment's strength)
      if (r > 0.18 && u.cls !== 'art') {
        const px = d / 2 + 1.5;
        ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(px - 4, 0); ctx.lineTo(px + 4, 0); ctx.stroke();
        const wv = Math.sin(this.t * 5 + u.id) * 0.9 * (u.mv ? 1.6 : 1);
        ctx.fillStyle = fc.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(px + 1, -3.2); ctx.lineTo(px + 4.6, -3.2 + wv); ctx.lineTo(px + 4.6, -0.2 + wv); ctx.lineTo(px + 1, -0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (u.state === 'fighting' && detail) { // sparks where steel meets steel
        const fk = Math.floor(this.t * 14);
        for (let q = 0; q < 4; q++) { const sy = Math.sin((fk + q * 7) * 12.9898) * (w / 2), sa = (fk * 1.7 + q * 2.1); ctx.strokeStyle = `rgba(255,245,200,${0.55 + 0.4 * Math.sin(fk + q)})`; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(d / 2 + 1, sy); ctx.lineTo(d / 2 + 1 + Math.cos(sa) * 3.2, sy + Math.sin(sa) * 3.2); ctx.stroke(); }
      }
      if (u.type === 'guard') { ctx.strokeStyle = 'rgba(240,192,64,0.8)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]); ctx.strokeRect(-d / 2 - 1, -w / 2 - 1, d + 2, w + 2); ctx.setLineDash([]); }
      if (u.formation === 'square') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.7; ctx.strokeRect(-d / 2, -w / 2, d, w); }
      if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.4, 2 / Math.max(0.6, sk)); ctx.setLineDash([5, 3]); ctx.strokeRect(-d / 2 - 3, -w / 2 - 3, d + 6, w + 6); ctx.setLineDash([]); }
    }

    drawGuns(ctx, u, w, d, fc, K, r, detail) {
      const guns = clamp(Math.ceil(u.men / 10), 1, 8), crew = clamp(Math.ceil(u.men / 8), 1, 10);
      const span = Math.max(w, 18);
      for (let g = 0; g < guns; g++) {
        const y = guns === 1 ? 0 : -span / 2 + (g + 0.5) / guns * span + (K[g][1] - 0.5) * (1 - r) * 4;
        const x = -2 + (K[g][2] - 0.5) * (1 - r) * 3;
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
        ctx.fillRect(x, y - 0.8, 8, 1.6);
        ctx.fillStyle = fc.color; ctx.fillRect(x - 5, y - 1.3, 3, 2.6);
        if (detail) { ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 0.5; ctx.strokeRect(x - 5, y - 1.3, 3, 2.6); }
      }
      for (let c = 0; c < crew; c++) {
        const k = K[40 + c]; ctx.fillStyle = fc.color;
        ctx.fillRect(-7 - k[0] * 5, -span / 2 + k[1] * span, 2, 2);
      }
    }

    drawUnit(ctx, u) {
      const fc = NAP.FACTIONS[u.faction];
      ctx.save();
      ctx.translate(u.x, u.y);
      if (u.cls === 'gen') {
        ctx.fillStyle = fc.color; ctx.strokeStyle = this.sel.has(u) ? '#fff' : '#111'; ctx.lineWidth = this.sel.has(u) ? 3 : 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd700'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 0, 0.5);
        if (this.sel.has(u)) { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(0, 0, 230, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
        ctx.restore(); return;
      }
      const w = u.w, d = u.d; // d along facing
      const sk = this.fit * this.cam.z; // device px per world unit
      const r = clamp(u.men / u.max, 0, 1);
      const sel = this.sel.has(u);
      // slow white pulse while locked in melee; solid white once the regiment breaks
      const hitF = u.hitT > 0 ? Math.min(1, u.hitT / 0.3) : 0;
      const wh = u.state === 'routing' ? 1 : u.state === 'fighting' ? 0.12 + 0.5 * (0.5 + 0.5 * Math.sin(this.t * 3.2 + u.id)) : 0;
      ctx.rotate(u.facing);
      ctx.globalAlpha = u.state === 'routing' ? 0.82 : 1;
      // team marker: cyan = yours, red = enemy, whatever the nation's uniform colour
      if (u.state !== 'routing') {
        const team = u.side === 0 ? '60,200,255' : '255,80,70';
        ctx.fillStyle = `rgba(${team},0.15)`; ctx.fillRect(-d / 2 - 4, -w / 2 - 4, d + 8, w + 8);
        ctx.strokeStyle = `rgba(${team},0.95)`; ctx.lineWidth = Math.max(1.2, 2.2 / Math.max(0.5, sk)); ctx.strokeRect(-d / 2 - 4, -w / 2 - 4, d + 8, w + 8);
      }
      if (Math.max(w, d) * sk < 46) {
        // far zoom: simple block, kept visible
        const boost = Math.min(3, Math.max(1, 7 / (Math.min(w, d) * sk)));
        const K = this.keys4(u), segs = 9, sw = w * boost / segs, keep = r > 0.85 ? 2 : 0.25 + 0.75 * r;
        ctx.fillStyle = tint(fc.color, wh);
        for (let i = 0; i < segs; i++) { if (K[i][0] > keep) continue; ctx.fillRect(-d / 2 + (K[i][1] - 0.5) * (1 - r) * 3, -w * boost / 2 + i * sw, d, sw * 0.92); }
        if (wh > 0) { ctx.save(); ctx.strokeStyle = '#fff'; ctx.globalAlpha = Math.min(1, 0.3 + wh * 0.9); ctx.lineWidth = (2 + wh * 2) / Math.max(0.5, sk); ctx.strokeRect(-d / 2 - 2, -w * boost / 2 - 2, d + 4, w * boost + 4); ctx.restore(); }
        ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,0.8)'; ctx.lineWidth = (sel ? 2.4 : 1.1) / Math.max(0.5, sk);
        if (sel || r > 0.85) ctx.strokeRect(-d / 2, -w * boost / 2, d, w * boost);
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(d / 2 - 1.6, -w * boost / 2, 1.6, w * boost * Math.max(0.3, r));
        { const fa = this.t - (u.volleyT === undefined ? -9 : u.volleyT); if (fa >= 0 && fa < 0.3) { ctx.fillStyle = `rgba(255,236,160,${0.9 * (1 - fa / 0.3)})`; ctx.fillRect(d / 2, -w * boost / 2, 3 / Math.max(0.5, sk), w * boost); } }
      } else this.drawFigures(ctx, u, w, d, fc, sk, r, sel, wh);
      if (hitF > 0) { ctx.fillStyle = `rgba(255,40,40,${0.35 * hitF})`; ctx.fillRect(-d / 2, -w / 2, d, w); }
      ctx.globalAlpha = 1;
      ctx.rotate(-u.facing);
      // bars and label scale gently with zoom so they stay readable
      const us = clamp(Math.pow(this.cam.z, -0.55), 0.4, 1.7), ext = Math.max(w, d) / 2;
      ctx.save(); ctx.translate(0, -ext - 6 * us); ctx.scale(us, us);
      const bw = 30, mp = clamp(u.morale / u.baseMorale, 0, 1), hp = r;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, 0, bw, 3.2);
      ctx.fillStyle = mp > 0.6 ? '#4c4' : mp > 0.3 ? '#ec3' : '#e44'; ctx.fillRect(-bw / 2, 0, bw * mp, 3.2);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, 3.6, bw, 2.2);
      ctx.fillStyle = '#ddd'; ctx.fillRect(-bw / 2, 3.6, bw * hp, 2.2);
      if (u.cls === 'cav') { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, 6.2, bw, 2.2); ctx.fillStyle = u.fatigue > 75 ? '#e55' : u.fatigue > 45 ? '#ec4' : '#4af'; ctx.fillRect(-bw / 2, 6.2, bw * clamp(1 - u.fatigue / 100, 0, 1), 2.2); } // stamina
      ctx.restore();
      if (sk > 0.5) {
        ctx.save(); ctx.translate(0, ext + 3 * us); ctx.scale(us, us);
        ctx.fillStyle = u.side === 0 ? '#a8ecff' : '#ffb4ac'; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2.5; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        const label = (u.grp ? '[' + u.grp + '] ' : '') + String(Math.round(u.men)) + (u.vet ? ' ' + '\u2605'.repeat(u.vet) : '');
        ctx.strokeText(label, 0, 0); ctx.fillText(label, 0, 0);
        ctx.restore();
      }
      if (u.state === 'routing') { ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textBaseline = 'middle'; ctx.strokeText('!', 0, 0); ctx.fillText('!', 0, 0); }
      if (u.wantForm) { ctx.fillStyle = '#fc6'; ctx.font = '8px sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('↻', 0, 0); }
      ctx.restore();
    }

    // ---------------------------------------------------------- HUD / input
    buildHUD() {
      const r = this.root;
      r.innerHTML = `
        <div class="b-top">
          <div class="b-side b-s0"><b id="b-n0"></b><div class="b-bar"><i id="b-f0"></i></div><span id="b-m0"></span></div>
          <div class="b-mid"><span id="b-time">0:00</span> &middot; <span id="b-terr"></span><br><span id="b-obj" data-tip="<b>Objectives</b><br>Hold flagged points to earn victory points (1 per point per second). Hold all of them for 75 seconds, or lead by 25 VP at the time limit, to win."></span></div>
          <div class="b-side b-s1"><b id="b-n1"></b><div class="b-bar"><i id="b-f1"></i></div><span id="b-m1"></span></div>
        </div>
        <div class="b-stage" id="b-stage"><canvas id="b-canvas"></canvas>
          <div class="b-banner" id="b-banner"></div>
          <div class="b-paused" id="b-paused" hidden>PAUSED &mdash; you can still give orders</div>
          <div class="b-feed" id="b-feed"></div>
          <canvas class="b-mini" id="b-mini" width="220" height="124" title="Click or drag to move the view"></canvas>
          <div class="b-tip" id="b-tip" hidden></div>
          <div class="b-help" id="b-help">Left-click/drag: select &middot; Right-click: move/attack (units halt to fire when an enemy comes in range; Ctrl+right-click moves without stopping) &middot; Right-drag: form a line &middot; Wheel / PgUp / PgDn: zoom &middot; Home: fit &middot; F: focus &middot; WASD / arrows / middle-drag: pan &middot; F1-F4 / Shift+1-4: formations &middot; Ctrl+1-9: save group, 1-9: recall &middot; C: charge &middot; R: rally &middot; Space: pause &middot; V: range cones &middot; +/-: speed</div>
        </div>
        <div class="b-bottom">
          <div class="b-info" id="b-info">Select units</div>
          <div class="b-btns">
            <button data-f="line" data-tip="<b>Line</b> (key F1)<br>Best firepower. Slow to move. Vulnerable on the flanks and rear.">Line <kbd>F1</kbd></button>
            <button data-f="column" data-tip="<b>Column</b> (key F2)<br>Fast marching, poor firepower. Weak against guns and cavalry. Use it to cross open ground.">Column <kbd>F2</kbd></button>
            <button data-f="square" data-tip="<b>Square</b> (key F3)<br>Near-immune to cavalry, no weak flank. Very slow, weak fire, hurt badly by artillery.">Square <kbd>F3</kbd></button>
            <button data-f="skirmish" data-tip="<b>Skirmish</b> (key F4)<br>Loose order: hard to hit, quick, weak in melee. Light infantry only.">Skirmish <kbd>F4</kbd></button>
            <button data-a="charge" data-tip="<b>Charge</b> (key C)<br>Order selected infantry or cavalry to run down the nearest enemy. Cavalry hit hardest in the first impact; squares shrug it off.">Charge <kbd>C</kbd></button>
            <button data-a="halt" data-tip="<b>Halt</b> (key H)<br>Cancel orders: the unit stops and fires at will.">Halt <kbd>H</kbd></button>
            <button data-a="rally" id="b-rally" data-tip="<b>Rally</b> (key R)<br>Your general restores order to routing units within his aura. 35 second cooldown.">Rally <kbd>R</kbd></button>
            <span class="b-sep"></span>
            <button data-a="pause" id="b-pause">&#9654; Start <kbd>Space</kbd></button>
            <button data-sp="0.25" class="b-sp" data-tip="Slow motion: a quarter speed. Best for careful orders.">&frac14;x</button><button data-sp="0.5" class="b-sp on" data-tip="Half speed (default)">&frac12;x</button><button data-sp="1" class="b-sp">1x</button><button data-sp="2" class="b-sp">2x</button><button data-sp="4" class="b-sp">4x</button>
            <span class="b-sep"></span>
            <span class="b-sep"></span><button data-z="out" title="Zoom out (PageDown)">&minus;</button><span id="b-zoom" class="b-zoomlbl">100%</span><button data-z="in" title="Zoom in (PageUp)">+</button><button data-z="fit" title="Fit whole field (Home)">Fit</button><button data-z="focus" title="Focus selection (F)">Focus</button>
            <button data-a="mute" data-nosound="1" id="b-mute" title="Sound on/off">&#128266;</button>
            <button data-a="withdraw" class="danger">Withdraw</button>
          </div>
        </div>`;
      this.stage = r.querySelector('#b-stage');
      this.canvas = r.querySelector('#b-canvas');
      this.ctx = this.canvas.getContext('2d');
      const sd = this.spec.sides;
      const nm = (s) => `${NAP.FACTIONS[sd[s].faction].name}${sd[s].general ? ' &mdash; ' + sd[s].general.name : ''}`;
      r.querySelector('#b-n0').innerHTML = nm(0); r.querySelector('#b-n1').innerHTML = nm(1);
      r.querySelector('.b-s0').style.setProperty('--c', NAP.FACTIONS[sd[0].faction].color);
      r.querySelector('.b-s1').style.setProperty('--c', NAP.FACTIONS[sd[1].faction].color);
      r.querySelector('#b-terr').textContent = `${this.spec.provName} · ${{ p: 'Plains', h: 'Hills', f: 'Forest', m: 'Mountains' }[this.spec.terrain]}${this.spec.fort ? ' · Fort ' + this.spec.fort : ''} · ${this.weatherName}`;
      r.querySelector('#b-banner').classList.add('deploy');
      r.querySelector('#b-banner').innerHTML = `<h2>Battle of ${this.spec.provName}</h2><p>${this.spec.playerIsAttacker ? 'You are attacking.' : 'You are defending.'} <b>Deploy:</b> select units and right-click (or right-drag a line) to place them in the shaded zone, change formations with <b>F1-F4</b>, then press <b>Space</b> to begin. Flagged circles are <b>objectives</b>: hold them to earn victory points.</p>`;
    }

    bind() {
      const r = this.root, st = this.stage;
      this.onResize = () => this.resize();
      window.addEventListener('resize', this.onResize);
      if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.stage); }
      const pos = (e) => { const b = this.canvas.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      this.canvas.addEventListener('mousedown', (e) => {
        const p = pos(e);
        if (e.button === 0) { this.box = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, shift: e.shiftKey }; }
        else if (e.button === 2) { const w = this.toWorld(p.x, p.y); this.rdrag = { sx: p.x, sy: p.y, p0: w }; }
        else if (e.button === 1) { this.pan = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y }; e.preventDefault(); }
      });
      window.addEventListener('mousemove', this.mm = (e) => {
        if (!this.canvas.isConnected) return;
        const p = pos(e);
        if (this.box) { this.box.x1 = p.x; this.box.y1 = p.y; }
        { const w0 = this.toWorld(p.x, p.y); let hv = null, bd = 6; const inside = p.x >= 0 && p.y >= 0 && p.x <= this.canvas.getBoundingClientRect().width && p.y <= this.canvas.getBoundingClientRect().height;
          if (inside) for (const u of this.units) { if (u.cls === 'gen' || u.dead || u.fled || !this.alive(u)) continue; const g = this.pointGap(u, w0); if (g < bd) { bd = g; hv = u; } }
          this.hoverUnit = hv; }
        if (this.rdrag) {
          const w = this.toWorld(p.x, p.y);
          if (Math.hypot(p.x - this.rdrag.sx, p.y - this.rdrag.sy) > 26) this.lineDrag = { p0: this.rdrag.p0, p1: w };
        }
        if (this.pan) { const k = this.fit * this.cam.z / devicePixelRatio; this.cam.x = this.pan.cx - (e.clientX - this.pan.x) / k; this.cam.y = this.pan.cy - (e.clientY - this.pan.y) / k; }
      });
      window.addEventListener('mouseup', this.mu = (e) => {
        if (!this.canvas.isConnected) return;
        const p = pos(e);
        if (e.button === 0 && this.box) {
          const b = this.box; this.box = null;
          if (Math.hypot(b.x1 - b.x0, b.y1 - b.y0) < 8) this.clickSelect(p, b.shift, e.detail >= 2);
          else this.boxSelect(b);
        } else if (e.button === 2 && this.rdrag) {
          const rd = this.rdrag; this.rdrag = null;
          const sel = this.selectedUnits();
          if (sel.length && !this.over) {
            if (this.lineDrag) { this.orderLine(sel, this.lineDrag.p0, this.lineDrag.p1); }
            else this.rightClick(rd.p0, sel, e);
          }
          this.lineDrag = null;
        } else if (e.button === 1) this.pan = null;
        this.updateInfo();
      });
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const dy = clamp(e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1), -240, 240);
        this.zoomBy(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0011)), pos(e).x, pos(e).y);
      }, { passive: false });
      const mini = r.querySelector('#b-mini');
      const miniMove = (e) => { const b = mini.getBoundingClientRect(); this.camGoal = null; this.cam.x = clamp((e.clientX - b.left) / b.width * FW, 0, FW); this.cam.y = clamp((e.clientY - b.top) / b.height * FH, 0, FH); };
      mini.addEventListener('mousedown', (e) => { this.miniDrag = true; miniMove(e); e.stopPropagation(); e.preventDefault(); });
      window.addEventListener('mousemove', this.mmini = (e) => { if (this.miniDrag) miniMove(e); });
      window.addEventListener('mouseup', this.umini = () => { this.miniDrag = false; });
      window.addEventListener('keydown', this.kd = (e) => {
        if (!this.canvas.isConnected) return;
        if (e.target && /input|textarea/i.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        this.keys[k] = true;
        const dg = /^Digit([1-9])$/.exec(e.code || '');
        if (/^f[1-4]$/.test(k)) { this.setForm(['line', 'column', 'square', 'skirmish'][+k[1] - 1]); e.preventDefault(); }
        else if (dg && e.shiftKey && +dg[1] <= 4) this.setForm(['line', 'column', 'square', 'skirmish'][+dg[1] - 1]);
        else if (dg && (e.ctrlKey || e.metaKey)) { this.saveGroup(+dg[1]); e.preventDefault(); }
        else if (dg) this.recallGroup(+dg[1]);
        else if (k === ' ') { this.togglePause(); e.preventDefault(); }
        else if (k === 'v') { this.showRange = this.showRange === false; }
        else if (k === 'c' && !e.ctrlKey) this.doCharge(); else if (k === 'h') this.halt(); else if (k === 'r') this.rally();
        else if (k === 'escape') { this.sel.clear(); this.updateInfo(); }
        else if (k === 'a' && e.ctrlKey) { this.units.filter((u) => u.side === 0 && this.alive(u)).forEach((u) => this.sel.add(u)); e.preventDefault(); this.updateInfo(); }
        else if (k === '+' || k === '=') this.stepSpeed(1); else if (k === '-') this.stepSpeed(-1);
        else if (k === 'tab') { e.preventDefault(); }
        else if (k === 'pageup') { this.zoomBy(1.4); e.preventDefault(); } else if (k === 'pagedown') { this.zoomBy(1 / 1.4); e.preventDefault(); }
        else if (k === 'home') { this.zoomFit(); e.preventDefault(); } else if (k === 'f') { this.focusSelection(); }
      });
      window.addEventListener('keyup', this.ku = (e) => { this.keys[e.key.toLowerCase()] = false; });
      r.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.f) this.setForm(b.dataset.f);
        else if (b.dataset.sp) this.setSpeed(+b.dataset.sp);
        else if (b.dataset.z) { const z = b.dataset.z; if (z === 'in') this.zoomBy(1.4); else if (z === 'out') this.zoomBy(1 / 1.4); else if (z === 'fit') this.zoomFit(); else this.focusSelection(); }
        else if (b.dataset.a === 'pause') this.togglePause();
        else if (b.dataset.a === 'charge') this.doCharge();
        else if (b.dataset.a === 'halt') this.halt();
        else if (b.dataset.a === 'rally') this.rally();
        else if (b.dataset.a === 'withdraw') this.withdraw();
        else if (b.dataset.a === 'mute') { if (NAP.audio) { NAP.audio.init(); NAP.audio.setMuted(!NAP.audio.muted); b.innerHTML = NAP.audio.muted ? '&#128263;' : '&#128266;'; } }
      }));
    }

    zoomBy(f, px, py) {
      const r = this.canvas.getBoundingClientRect();
      if (px === undefined) { px = r.width / 2; py = r.height / 2; }
      this.zt = clamp(this.zt * f, 0.4, 8);
      const w = this.toWorld(px, py);
      this.zAnchor = { px, py, wx: w.x, wy: w.y };
    }
    zoomFit() { this.zt = 1; this.zAnchor = null; this.camGoal = { x: FW / 2, y: FH / 2 }; }
    focusSelection() {
      const us = this.selectedUnits().filter((u) => u.cls !== 'gen' || !u.dead);
      const list = us.length ? us : this.units.filter((u) => u.side === 0 && u.cls !== 'gen' && this.alive(u));
      if (!list.length) return;
      const cx = list.reduce((a, u) => a + u.x, 0) / list.length, cy = list.reduce((a, u) => a + u.y, 0) / list.length;
      let ext = 120; for (const u of list) ext = Math.max(ext, Math.hypot(u.x - cx, u.y - cy) + 60);
      this.zt = clamp(Math.min(FW, FH * 1.6) / (ext * 3.2), 0.9, 6); this.zAnchor = null; this.camGoal = { x: cx, y: cy };
    }

    clickSelect(p, add, dbl) {
      const w = this.toWorld(p.x, p.y);
      let hit = null, bd = 1e9;
      for (const u of this.units) {
        if (u.side !== 0 || (u.cls !== 'gen' && !this.alive(u)) || u.dead || u.fled) continue;
        const d = u.cls === 'gen' ? Math.hypot(u.x - w.x, u.y - w.y) - 4 : this.pointGap(u, w);
        if (d < clamp(16 * (window.devicePixelRatio || 1) / (this.fit * this.cam.z), 6, 45) && d < bd) { bd = d; hit = u; }
      }
      if (!add) this.sel.clear();
      if (hit) {
        if (dbl && hit.cls !== 'gen') this.units.forEach((u) => { if (u.side === 0 && u.type === hit.type && this.alive(u)) this.sel.add(u); });
        else if (add && this.sel.has(hit)) this.sel.delete(hit); else this.sel.add(hit);
      }
      this.updateInfo();
    }
    pointGap(u, w) {
      const dx = w.x - u.x, dy = w.y - u.y, c = Math.cos(-u.facing), s = Math.sin(-u.facing);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      const ox = Math.abs(lx) - u.d / 2, oy = Math.abs(ly) - u.w / 2;
      return Math.hypot(Math.max(ox, 0), Math.max(oy, 0)) + Math.min(Math.max(ox, oy), 0);
    }
    boxSelect(b) {
      const a = this.toWorld(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1)), c = this.toWorld(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
      if (!b.shift) this.sel.clear();
      for (const u of this.units) if (u.side === 0 && !u.dead && !u.fled && u.x >= a.x && u.x <= c.x && u.y >= a.y && u.y <= c.y) this.sel.add(u);
      this.updateInfo();
    }
    rightClick(w, sel, e) {
      // enemy under cursor?
      let hit = null, bd = 1e9;
      for (const u of this.units) {
        if (u.side !== 1 || u.cls === 'gen' || !this.alive(u)) continue;
        const d = this.pointGap(u, w);
        if (d < 10 && d < bd) { bd = d; hit = u; }
      }
      if (hit) this.orderAttack(sel, hit, e.ctrlKey || e.shiftKey);
      else this.orderMove(sel, w.x, w.y, e.ctrlKey);
    }
    setForm(f) { this.selectedUnits().forEach((u) => u.cls !== 'gen' && u.state !== 'routing' && this.setFormation(u, f)); this.updateInfo(); }
    doCharge() {
      const sel = this.selectedUnits().filter((u) => u.cls === 'inf' || u.cls === 'cav');
      const en = this.enemies(0);
      sel.forEach((u) => { const t = this.nearest(u, en); if (t) this.orderAttack([u], t, true); });
    }
    halt() { this.selectedUnits().forEach((u) => { u.order = null; u.target = null; }); }
    rally() { if (!this.tryRally(0)) this.msg(this.rallyCd[0] > 0 ? `Rally ready in ${Math.ceil(this.rallyCd[0])}s` : 'No routing units near the general.'); }
    saveGroup(n) {
      const us = this.selectedUnits().filter((u) => this.alive(u)); if (!us.length) return;
      for (const u of this.units) if (u.grp === n) u.grp = 0;
      this.groups[n] = us; us.forEach((u) => { u.grp = n; });
      this.msg(`Group ${n} saved (${us.length} unit${us.length > 1 ? 's' : ''})`);
    }
    recallGroup(n) {
      const g = (this.groups[n] || []).filter((u) => this.alive(u) && !u.fled); if (!g.length) return;
      const now = performance.now(), dbl = this._lastGrp === n && now - this._lastGrpT < 400;
      this._lastGrp = n; this._lastGrpT = now;
      this.sel.clear(); g.forEach((u) => this.sel.add(u)); this.updateInfo();
      if (dbl) this.focusSelection();
    }
    togglePause() {
      if (this.over) return;
      this.paused = !this.paused;
      if (!this.paused) this.deployPhase = false;
      this.root.querySelector('#b-pause').innerHTML = this.paused ? '&#9654; Resume <kbd>Space</kbd>' : '&#10074;&#10074; Pause <kbd>Space</kbd>';
      this.root.querySelector('#b-banner').classList.toggle('hide', !this.paused ? true : this.t > 0);
      this.root.querySelector('#b-help').classList.add('hide');
    }
    stepSpeed(d) { const L = [0.25, 0.5, 1, 2, 4]; const i = L.indexOf(this.speed); this.setSpeed(L[Math.max(0, Math.min(L.length - 1, (i < 0 ? 1 : i) + d))]); }
    setSpeed(s) { this.speed = s; this.root.querySelectorAll('.b-sp').forEach((b) => b.classList.toggle('on', +b.dataset.sp === s)); }
    withdraw() {
      if (this.over) return;
      const wb = this.root.querySelector('[data-a="withdraw"]');
      if (!this.wdArmed) { // in-page confirmation (browser dialogs are blocked in some viewers)
        this.wdArmed = true; if (wb) wb.textContent = 'Really withdraw?';
        setTimeout(() => { this.wdArmed = false; if (wb && !this.over) wb.textContent = 'Withdraw'; }, 3500);
        this.msg('Press Withdraw again to confirm: your army will suffer heavily and the battle is lost.');
        return;
      }
      this.forced = 1;
      for (const u of this.units) if (u.side === 0 && u.cls !== 'gen' && this.alive(u)) u.state = 'routing';
      this.checkEnd();
    }

    updateInfo() {
      const el = this.root.querySelector('#b-info');
      const sel = this.selectedUnits();
      if (!sel.length) { el.innerHTML = 'Select units to give orders.'; return; }
      if (sel.length === 1) {
        const u = sel[0];
        if (u.cls === 'gen') { el.innerHTML = `<b>${u.name}</b> &mdash; Commander (ATK ${u.gen.atk} DEF ${u.gen.def} LEAD ${u.gen.lead}). Aura boosts morale &amp; fire nearby.`; return; }
        el.innerHTML = `<b>${NAP.UNITS[u.type].name}</b> &middot; ${Math.round(u.men)}/${u.max} men &middot; morale ${Math.round(u.morale)} &middot; fatigue ${Math.round(u.fatigue)} &middot; ${FORM_NAMES[u.formation]}${u.state === 'routing' ? ' &middot; <span class="bad">ROUTING</span>' : ''}`;
      } else {
        const men = sel.filter((u) => u.cls !== 'gen').reduce((a, u) => a + u.men, 0);
        el.innerHTML = `<b>${sel.length}</b> units selected &middot; ${Math.round(men)} men`;
      }
    }

    // ---------------------------------------------------------- loop
    frame(now) {
      if (this.stopped) return;
      const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
      // smooth zoom toward the target, keeping the point under the cursor fixed
      if (Math.abs(this.zt - this.cam.z) > 0.0005) {
        this.cam.z += (this.zt - this.cam.z) * (1 - Math.exp(-dt * 18));
        if (this.zAnchor) { const a = this.zAnchor, w = this.toWorld(a.px, a.py); this.cam.x += a.wx - w.x; this.cam.y += a.wy - w.y; }
      }
      if (this.camGoal) { const g = this.camGoal, k = 1 - Math.exp(-dt * 10); this.cam.x += (g.x - this.cam.x) * k; this.cam.y += (g.y - this.cam.y) * k; if (Math.hypot(g.x - this.cam.x, g.y - this.cam.y) < 1) this.camGoal = null; }
      // camera keys
      const ks = 520 * dt / this.cam.z;
      if (this.keys.arrowleft || this.keys.arrowright || this.keys.arrowup || this.keys.arrowdown || this.keys.a || this.keys.d || this.keys.s || this.keys.w) this.camGoal = null;
      if (this.keys.a && !this.keys.control) this.cam.x -= ks; if (this.keys.d) this.cam.x += ks;
      if (this.keys.arrowleft) this.cam.x -= ks; if (this.keys.arrowright) this.cam.x += ks;
      if (this.keys.arrowup) this.cam.y -= ks; if (this.keys.arrowdown) this.cam.y += ks;
      if (this.keys.s) this.cam.y += ks; if (this.keys.w) this.cam.y -= ks;
      this.cam.x = clamp(this.cam.x, 0, FW); this.cam.y = clamp(this.cam.y, 0, FH);
      if (this.replay) this.stepReplay(dt);
      if (!this.paused && !this.over) {
        this.acc += dt * this.speed;
        let n = 0;
        while (this.acc >= 0.05 && n++ < 40) { this.step(0.05); this.acc -= 0.05; }
      }
      this.draw();
      this.hud();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }

    updateTip() {
      const tips = NAP.guide && NAP.guide.BATTLE_TIPS; if (!tips) return;
      const order = ['cav', 'rout', 'deploy', 'advance', 'range', 'win'];
      const now = performance.now();
      const el = this.root.querySelector('#b-tip');
      if (this.tipOff || this.over || this.replay) { el.hidden = true; return; }
      let cand = null;
      for (const id of order) { const t = tips.find((x) => x.id === id); if (t && (!this.tipSeen || !this.tipSeen[id] || id === 'deploy') && t.when(this)) { cand = t; break; } }
      if (!this.tipCur || (cand && cand.id !== this.tipCur.id && now > this.tipCur.until)) {
        if (cand) { this.tipCur = { id: cand.id, until: now + 7000 }; (this.tipSeen = this.tipSeen || {})[cand.id] = true; }
      }
      const show = this.tipCur && tips.find((x) => x.id === this.tipCur.id);
      if (!show || (this.tipCur.id !== 'deploy' && now > this.tipCur.until + 5000) || (this.tipCur.id === 'deploy' && !this.deployPhase)) {
        if (this.tipCur && this.tipCur.id === 'deploy' && !this.deployPhase) this.tipCur.until = 0;
        if (!cand) { el.hidden = true; this.tipCur = null; return; }
      }
      const cur = this.tipCur && tips.find((x) => x.id === this.tipCur.id);
      if (!cur) { el.hidden = true; return; }
      if (el.dataset.id !== cur.id) { el.innerHTML = cur.text + '<button class="tipx" title="Hide tips">&times;</button>'; el.dataset.id = cur.id; el.querySelector('.tipx').onclick = () => { this.tipOff = true; el.hidden = true; }; }
      el.hidden = false;
    }

    drawMini() {
      const m = this.root.querySelector('#b-mini'); if (!m) return;
      const x = m.getContext('2d'), k = m.width / FW;
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.fillStyle = this.terrain.base; x.fillRect(0, 0, m.width, m.height);
      x.fillStyle = 'rgba(30,70,30,0.6)'; for (const f of this.terrain.forests) { x.beginPath(); x.ellipse(f.x * k, f.y * k, f.rx * k, f.ry * k, 0, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(230,220,160,0.6)'; for (const h of this.terrain.hills) { x.beginPath(); x.arc(h.x * k, h.y * k, h.r * k, 0, TAU); x.fill(); }
      for (const o of this.objs || []) { x.strokeStyle = o.owner === 0 ? '#6af' : o.owner === 1 ? '#f66' : '#ddd'; x.lineWidth = 1.2; x.beginPath(); x.arc(o.x * k, o.y * k, Math.max(3, o.r * k), 0, TAU); x.stroke(); }
      const fog = this.spec.weather === 'fog' && !this.over && !this.replay;
      const mine = fog ? this.units.filter((u) => u.side === 0 && this.alive(u)) : null;
      for (const u of this.units) {
        if (u.fled || u.dead) continue;
        if (fog && u.side === 1 && !mine.some((q) => Math.hypot(q.x - u.x, q.y - u.y) < 400)) continue;
        x.fillStyle = NAP.FACTIONS[u.faction].color; x.globalAlpha = u.state === 'routing' ? 0.5 : 1;
        const sz = u.cls === 'gen' ? 3.2 : u.cls === 'art' ? 2.2 : 2.8 + 1.6 * clamp(u.men / u.max, 0, 1);
        x.fillRect(u.x * k - sz / 2, u.y * k - sz / 2, sz, sz); x.globalAlpha = 1;
        x.strokeStyle = u.side === 0 ? '#4cf' : '#f55'; x.lineWidth = 1; x.strokeRect(u.x * k - sz / 2 - 0.5, u.y * k - sz / 2 - 0.5, sz + 1, sz + 1);
        if (this.sel.has(u)) { x.strokeStyle = '#fff'; x.lineWidth = 1; x.strokeRect(u.x * k - sz / 2 - 1, u.y * k - sz / 2 - 1, sz + 2, sz + 2); }
      }
      const c = this.canvas, vw = c.width / (this.fit * this.cam.z), vh = c.height / (this.fit * this.cam.z);
      x.strokeStyle = '#fff'; x.lineWidth = 1.4; x.strokeRect((this.cam.x - vw / 2) * k, (this.cam.y - vh / 2) * k, vw * k, vh * k);
    }

    hud() {
      const r = this.root;
      { const mini = r.querySelector('#b-mini'); if (mini) mini.style.display = this.cam.z > 1.15 ? 'block' : 'none'; }
      this.drawMini();
      if (this.spec.tutorial) this.updateTip();
      for (const s of [0, 1]) {
        const tot = this.totalMen(s), init = this.initialMen[s] || 1;
        r.querySelector('#b-f' + s).style.width = clamp((tot / init) * 100, 0, 100) + '%';
        r.querySelector('#b-m' + s).textContent = `${Math.round(tot)} / ${init}`;
      }
      const pz = r.querySelector('#b-paused'); if (pz) pz.hidden = !(this.paused && this.t > 0 && !this.over && !this.replay);
      const ob = r.querySelector('#b-obj');
      if (ob && this.objs && this.objs.length) {
        const h = this.objs.map((o) => `<span class="ob ob${o.owner}" title="${o.name}">\u25A0</span>`).join('') + ` VP ${this.vp[0]}\u2013${this.vp[1]}`
          + (this.holdT[0] > 0 ? ` \u00B7 <b class="good">hold ${Math.max(0, Math.ceil(75 - this.holdT[0]))}s</b>` : this.holdT[1] > 0 ? ` \u00B7 <b class="bad">enemy hold ${Math.max(0, Math.ceil(75 - this.holdT[1]))}s</b>` : '');
        if (ob.dataset.h !== h) { ob.innerHTML = h; ob.dataset.h = h; }
      }
      const zl = r.querySelector('#b-zoom'); if (zl) zl.textContent = Math.round(this.cam.z * 100) + '%';
      const t = Math.floor(this.t);
      r.querySelector('#b-time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
      const feed = r.querySelector('#b-feed');
      const html = this.msgs.filter((m) => this.t - m.t < 12).map((m) => `<div>${m.text}</div>`).join('');
      if (feed.dataset.h !== html) { feed.innerHTML = html; feed.dataset.h = html; }
      r.querySelector('#b-rally').textContent = this.rallyCd[0] > 0 ? `Rally (${Math.ceil(this.rallyCd[0])}s)` : 'Rally';
      if (this.sel.size === 1 && !this.over && Math.floor(this.t * 4) !== this._lastInfo) { this._lastInfo = Math.floor(this.t * 4); this.updateInfo(); }
    }

    showEnd(winner, cas) {
      const b = this.root.querySelector('#b-banner');
      b.classList.remove('hide', 'deploy'); b.classList.add('report');
      const win = winner === 0;
      const rows = (side) => (this.report || []).filter((r) => r.side === side).sort((x, y) => y.kills - x.kills);
      const tbl = (side) => `<table class="t"><tr><th>Regiment</th><th>Start</th><th>Left</th><th>Kills</th><th>Fate</th></tr>${rows(side).map((r) => `<tr><td>${r.name}</td><td>${r.start}</td><td>${r.end}</td><td>${r.kills}</td><td class="${r.status === 'Intact' ? 'good' : r.status === 'Destroyed' || r.status === 'Fled' ? 'bad' : ''}">${r.status}</td></tr>`).join('')}</table>`;
      const m = Math.floor(this.t / 60), sc = Math.floor(this.t % 60);
      const gl = this.genDead[0] ? '<span class="bad">Your general was killed.</span> ' : '';
      const gl2 = this.genDead[1] ? '<span class="good">The enemy general was killed.</span>' : '';
      const sd = this.spec.sides;
      b.innerHTML = `<h2 class="${win ? 'good' : 'bad'}">${win ? 'Victory!' : 'Defeat'}</h2>
        <p>Battle of ${this.spec.provName} \u00B7 ${m}:${String(sc).padStart(2, '0')} \u00B7 Your losses <b>${Math.round(cas[0])}</b> \u00B7 Enemy losses <b>${Math.round(cas[1])}</b><br>Objectives (victory points): <b>${this.vp[0]}</b> \u2013 <b>${this.vp[1]}</b>${this.endReason ? ' \u00B7 ' + this.endReason : ''}<br>${gl}${gl2}</p>
        <div class="rep-cols"><div><h4 style="color:${NAP.FACTIONS[sd[0].faction].color}">${NAP.FACTIONS[sd[0].faction].name}</h4>${tbl(0)}</div><div><h4>${NAP.FACTIONS[sd[1].faction].name}</h4>${tbl(1)}</div></div>
        <p style="margin-top:12px"><button id="b-replay">&#9654; Watch replay</button> <button id="b-cont" class="primary">Continue</button></p>`;
      b.querySelector('#b-cont').addEventListener('click', () => this.close());
      b.querySelector('#b-replay').addEventListener('click', () => this.startReplay());
    }

    // ---- replay of the recorded battle (1 frame per simulated second)
    startReplay() {
      if (!this.recStatic || this.rec.length < 2) return;
      this.live = this.units;
      this.units = this.recStatic.map((t) => ({ ...t }));
      this.replay = { f: 0 };
      this.sel.clear();
      const b = this.root.querySelector('#b-banner'); b.classList.add('hide');
      const bar = document.createElement('div'); bar.id = 'b-replaybar'; bar.className = 'b-replaybar';
      bar.innerHTML = 'REPLAY &middot; <button id="b-rp-speed">8x</button> <button id="b-rp-stop">Back to report</button>';
      this.stage.appendChild(bar);
      this.rpSpeed = 8;
      bar.querySelector('#b-rp-stop').onclick = () => this.stopReplay();
      bar.querySelector('#b-rp-speed').onclick = (e) => { this.rpSpeed = this.rpSpeed === 8 ? 24 : this.rpSpeed === 24 ? 3 : 8; e.target.textContent = this.rpSpeed + 'x'; };
    }
    stepReplay(dt) {
      const r = this.replay; r.f += dt * this.rpSpeed;
      const n = this.rec.length - 1;
      if (r.f >= n) { this.stopReplay(); return; }
      const i = Math.floor(r.f), k = r.f - i, A = this.rec[i], B = this.rec[i + 1];
      this.units.forEach((u, j) => {
        const a = A[j], c = B[j];
        u.x = a[0] + (c[0] - a[0]) * k; u.y = a[1] + (c[1] - a[1]) * k;
        let df = c[2] - a[2]; while (df > Math.PI) df -= TAU; while (df < -Math.PI) df += TAU;
        u.facing = a[2] + df * k;
        u.men = a[3] + (c[3] - a[3]) * k; u.state = a[4] === 1 ? 'routing' : a[4] === 2 ? 'fighting' : 'idle'; u.dead = !!a[5]; u.fled = !!a[6]; u.formation = a[7]; u.morale = a[8];
        if (u.cls === 'gen') { u.w = u.d = 14; } else [u.w, u.d] = dims(u);
      });
      this.t = r.f;
    }
    stopReplay() {
      if (!this.replay) return;
      this.replay = null; this.units = this.live; this.live = null;
      const bar = this.root.querySelector('#b-replaybar'); if (bar) bar.remove();
      this.root.querySelector('#b-banner').classList.remove('hide');
    }

    close() {
      if (NAP.audio) NAP.audio.music('map');
      if (this.replay) this.stopReplay();
      this.stopped = true;
      cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this.onResize);
      if (this.ro) this.ro.disconnect();
      window.removeEventListener('mousemove', this.mm); window.removeEventListener('mouseup', this.mu); window.removeEventListener('mousemove', this.mmini); window.removeEventListener('mouseup', this.umini);
      window.removeEventListener('keydown', this.kd); window.removeEventListener('keyup', this.ku);
      this.root.innerHTML = '';
      this.done(this.result);
    }
  }

  // spec: see campaign.resolveBattle
  NAP.runBattle = function (spec, root) {
    return new Promise((resolve) => { NAP.currentBattle = new Battle(spec, root, resolve); });
  };
  NAP.Battle = Battle;
  NAP.BT = BT;
})();
