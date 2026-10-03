/* NAPWORLD - real-time tactical battles (rectangles on a field) */
(function () {
  const NAP = window.NAP;
  const FW = 1600, FH = 900;
  const TAU = Math.PI * 2;
  const rnd = Math.random;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // Battle stats per unit class/type
  const BT = {
    line:    { range: 95,  fire: 0.0050, melee: 0.0036, speed: 24, turn: 1.6, forms: ['line', 'column', 'square'] },
    light:   { range: 115, fire: 0.0044, melee: 0.0030, speed: 34, turn: 2.2, forms: ['skirmish', 'line', 'column', 'square'] },
    guard:   { range: 100, fire: 0.0085, melee: 0.0075, speed: 24, turn: 1.6, forms: ['line', 'column', 'square'] },
    hussar:  { range: 0,   fire: 0,      melee: 0.0066, speed: 74, turn: 3.0, forms: ['line'] },
    cuirass: { range: 0,   fire: 0,      melee: 0.0090, speed: 58, turn: 2.6, forms: ['line'] },
    art:     { range: 330, fire: 0,      melee: 0.0010, speed: 11, turn: 1.0, forms: ['line'] }
  };
  const FORM_SPEED = { line: 0.85, column: 1.25, square: 0.35, skirmish: 1.1 };
  const FORM_FIRE = { line: 1.0, column: 0.3, square: 0.5, skirmish: 0.55 };
  const FORM_TAKE = { line: 1.0, column: 1.3, square: 1.0, skirmish: 0.5 };
  const FORM_CAV_VULN = { line: 1.0, column: 1.5, square: 0.10, skirmish: 1.8 };
  const FORM_ART_VULN = { line: 1.0, column: 1.6, square: 1.7, skirmish: 0.4 };
  const FORM_NAMES = { line: 'Line', column: 'Column', square: 'Square', skirmish: 'Skirmish' };

  function dims(u) {
    const base = NAP.UNITS[u.type];
    const f = u.formation, n = u.men / base.men;
    if (u.cls === 'inf') {
      if (f === 'line') return [base.w * (0.45 + 0.55 * n) + 18, 11];
      if (f === 'column') return [26, 36 + 26 * n];
      if (f === 'square') return [38 * (0.6 + 0.4 * n), 38 * (0.6 + 0.4 * n)];
      return [base.w * (0.45 + 0.55 * n) + 34, 20];
    }
    if (u.cls === 'cav') return [22 + 28 * n, 11];
    return [30, 14];
  }

  function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
  function turnToward(cur, want, maxStep) { const d = angDiff(want, cur); return Math.abs(d) <= maxStep ? want : cur + Math.sign(d) * maxStep; }

  class Battle {
    constructor(spec, root, done) {
      this.spec = spec; this.root = root; this.done = done;
      this.t = 0; this.deployPhase = true; this.speed = 1; this.paused = true; this.over = false; this.acc = 0;
      this.units = []; this.puffs = []; this.shots = []; this.dead = []; this.msgs = [];
      this.sel = new Set();
      this.cam = { x: FW / 2, y: FH / 2, z: 1 };
      this.keys = {};
      this.nextId = 1;
      this.rallyCd = [0, 0];
      this.initialMen = [0, 0];
      this.deadGen = [];
      this.genDead = [false, false];
      this.buildTerrain();
      this.prerender();
      this.deploy();
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
      place(nv, (x, y) => T.villages.push({ x, y, hs: Array.from({ length: 5 }, () => [(r() - 0.5) * 70, (r() - 0.5) * 50, 14 + r() * 8, 10 + r() * 6]) }), 600, 1000);
      if (tr === 'm') place(7, (x, y) => T.rocks.push({ x, y, r: 16 + r() * 18, a: r() * 6 }), 380, 1220);
      // drop trees outside their ellipse
      T.forests.forEach((f) => (f.trees = f.trees.filter((t) => t[0] * t[0] + t[1] * t[1] <= 1)));
      // fortification marker for siege defences (decor only)
      T.fort = this.spec.fort || 0;
      T.noise = Array.from({ length: 180 }, () => [r() * FW, r() * FH, 20 + r() * 50, r()]);
      this.terrain = T;
    }

    terrainAt(x, y) {
      const T = this.terrain;
      let speed = 1, cover = 1, hill = false, forest = false, village = false;
      for (const h of T.hills) if ((x - h.x) ** 2 + (y - h.y) ** 2 < h.r * h.r) { hill = true; speed *= 0.85; cover *= 0.88; }
      for (const f of T.forests) if (((x - f.x) / f.rx) ** 2 + ((y - f.y) / f.ry) ** 2 < 1) { forest = true; speed *= 0.6; cover *= 0.72; }
      for (const v of T.villages) if (Math.abs(x - v.x) < 45 && Math.abs(y - v.y) < 35) { village = true; speed *= 0.7; cover *= 0.7; }
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
        baseMorale: clamp(base.morale * fac.morale + (g ? (g.lead - 3) * 2.2 : 0), 30, 110),
        morale: 0, fatigue: 0, formation: bt.forms[0], wantForm: null, formT: 0,
        state: 'idle', order: null, target: null, reload: rnd() * 4, routT: 0, calm: 0,
        kills: 0, impacted: false, charging: false, cooldown: 0, sinceHit: 99, role: 0, name: base.short,
        fireMul: fac.fire * (g ? 1 + (g.atk - 3) * 0.03 : 1),
        takeMul: g ? 1 - (g.def - 3) * 0.025 : 1
      };
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
        const baseX = s === 0 ? 330 : 1270;
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
        place(first, baseX, 74, 6); place(second, baseX - dir * 70, 80, 8);
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
      target.sinceHit = 0;
      if (src) src.kills += cas;
      const m = (cas / target.max) * 100 * 1.7 * (moraleMul || 1);
      target.morale -= m;
      if (target.men < 1) { target.men = 0; target.dead = true; }
      // blood stains
      if (rnd() < cas * 0.35 && this.dead.length < 900) this.dead.push([target.x + (rnd() - 0.5) * target.w, target.y + (rnd() - 0.5) * target.d, target.side]);
    }

    step(dt) {
      this.t += dt;
      for (const g of [0, 1]) this.rallyCd[g] = Math.max(0, this.rallyCd[g] - dt);
      const us = this.units;
      // AI
      this.aiTimer = (this.aiTimer || 0) - dt;
      if (this.aiTimer <= 0) { this.aiTimer = 0.6; this.aiThink(1); if (this.spec.aiBothSides) this.aiThink(0); }
      for (const u of us) {
        if (u.cls === 'gen') { this.stepGeneral(u, dt); continue; }
        if (!this.alive(u)) continue;
        this.stepUnit(u, dt);
      }
      // morale contagion handled in stepUnit via routing events
      // effects decay
      for (const p of this.puffs) p.t += dt;
      this.puffs = this.puffs.filter((p) => p.t < p.life);
      for (const s of this.shots) s.t += dt;
      this.shots = this.shots.filter((s) => s.t < 0.35);
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
      const maxRange = bt.range * (tinfo.hill ? 1.08 : 1) * (u.cls === 'art' ? 1 : 1);
      // order handling (movement)
      let moving = false;
      let moveSpeed = 0;
      if (u.order) {
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
              let sp = bt.speed * (FORM_SPEED[u.formation] || 1) * tinfo.speed * (1 - u.fatigue / 220);
              u.charging = false;
              const chargeNow = (u.cls === 'cav' && u.order.type === 'attack' && d < 260) || (u.order.charge && d < 170);
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
      u.fatigue = clamp(u.fatigue + (moving ? (moveSpeed > bt.speed * 1.3 ? 2 : 0.7) : melee ? 1.2 : -1.5) * dt, 0, 100);
      // friendly separation
      for (const f of this.units) {
        if (f === u || f.side !== s || f.cls === 'gen' || !this.alive(f) || f.state === 'routing') continue;
        const dx = u.x - f.x, dy = u.y - f.y, d = Math.hypot(dx, dy) || 0.1;
        const gp = this.gap(u, f);
        if (gp < 0 && d < 70) { const push = Math.min(-gp * 0.3, 14 * dt); u.x += (dx / d) * push * 0.5; u.y += (dy / d) * push * 0.5; }
      }
      u.x = clamp(u.x, 5, FW - 5); u.y = clamp(u.y, 5, FH - 5);

      // ---------------- combat
      let firing = false;
      const stationary = !moving || u.formation === 'skirmish';
      if (melee) {
        // melee: face enemy
        u.facing = turnToward(u.facing, Math.atan2(melee.y - u.y, melee.x - u.x), bt.turn * dt * 1.2);
        const ex = this.exposure(melee, u);
        let dps = u.men * bt.melee * u.fireMul * (0.7 + 0.3 * u.morale / 100) * (1 - u.fatigue / 300);
        if (u.cls === 'art') dps *= 0.5;
        // formation matchups for cavalry in melee
        let vuln = 1;
        if (u.cls === 'cav') vuln = melee.cls === 'cav' ? 1 : melee.cls === 'art' ? 1.8 : (FORM_CAV_VULN[melee.formation] || 1);
        // impact of charge
        if (u.charging && !u.impacted && u.state !== 'routing') {
          u.impacted = true; u.cooldown = 5;
          const shock = u.cls === 'cav' ? 0.8 : 0.22;
          const tf = melee.state === 'routing' ? 2.2 : 1;
          const instant = u.men * shock * vuln * tf * (0.6 + 0.4 * u.morale / 100) * (ex > 1 ? 1.25 : 1) * (1 - u.fatigue / 250);
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
            if (!u.order || u.order.holdFire) u.facing = turnToward(u.facing, Math.atan2(tgt.y - u.y, tgt.x - u.x), bt.turn * dt * 0.6);
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
                cas = base * vuln * ex * tt.cover * mor * u.fireMul * aura * (1 - u.fatigue / 300);
              } else {
                const acc = 0.45 + 0.55 * (1 - d / maxRange);
                const vuln = tgt.cls === 'cav' ? 0.95 : tgt.cls === 'art' ? 0.8 : 1;
                cas = u.men * bt.fire * (FORM_FIRE[u.formation] || 1) * acc * vuln * ex * tt.cover * mor * u.fireMul * aura * (1 - u.fatigue / 300);
              }
              this.damage(tgt, cas * dt, u, ex > 1 ? 1.35 : 1);
              firing = true;
              u.reload -= dt;
              if (u.reload <= 0) {
                u.reload = u.cls === 'art' ? 2.6 + rnd() : 3.5 + rnd() * 2;
                const fx = u.x + Math.cos(u.facing) * (u.d / 2 + 4), fy = u.y + Math.sin(u.facing) * (u.d / 2 + 4);
                this.puffs.push({ x: fx, y: fy, t: 0, life: u.cls === 'art' ? 4.5 : 2.6, r: u.cls === 'art' ? 13 : 8, c: 'rgba(235,235,235,' });
                this.shots.push({ x0: fx, y0: fy, x1: tgt.x + (rnd() - 0.5) * tgt.w * 0.6, y1: tgt.y + (rnd() - 0.5) * tgt.d * 0.6, t: 0, art: u.cls === 'art' });
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
        this.msg(`${NAP.FACTIONS[u.faction].adj} ${u.name} breaks and runs!`);
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
      // retreat decision
      const routed = my.filter((u) => u.state === 'routing').length;
      for (const u of my) {
        if (u.state === 'routing') continue;
        const e = this.nearest(u, en); if (!e) continue;
        const d = Math.hypot(e.x - u.x, e.y - u.y);
        const bt = BT[u.type];
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
          if (d > bt.range * 0.8 + 6) {
            if (!u.order || u.order.type !== 'attack' || !this.alive(u.order.target) || this.t % 5 < 0.7) {
              // prefer enemy directly ahead, spread targets by lane
              u.order = { type: 'attack', target: e, charge: false };
            }
          } else if (u.order) { u.order = null; }
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
          if (close && my.some((f) => f.cls === 'inf' && Math.hypot(f.x - u.x, f.y - u.y) < 80)) { /* stay; infantry protect */ }
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
      if (n) { this.rallyCd[s] = 35; this.msg(`${g.name} rallies ${n} unit${n > 1 ? 's' : ''}!`); return true; }
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
      else if (this.t > 600) winner = s0 >= s1 ? 0 : 1;
      if (this.forced !== undefined) winner = this.forced;
      if (winner !== null) this.finish(winner);
    }

    finish(winner) {
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
      u.x = clamp(o.x, 30, 570); u.y = clamp(o.y, 30, FH - 30);
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
      gens.forEach((g) => { if (this.deployPhase) { g.x = clamp(x, 30, 570); g.y = clamp(y, 30, FH - 30); } else g.order = { type: 'move', x, y }; });
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
      for (const v of T.villages) for (const h of v.hs) { ctx.fillStyle = '#b98f66'; ctx.fillRect(v.x + h[0] - h[2] / 2, v.y + h[1] - h[3] / 2, h[2], h[3]); ctx.fillStyle = '#8a4a3a'; ctx.fillRect(v.x + h[0] - h[2] / 2, v.y + h[1] - h[3] / 2, h[2], 3); }
      for (const r of T.rocks) { ctx.fillStyle = '#7d786c'; ctx.beginPath(); for (let i = 0; i < 7; i++) { const a = r.a + i * TAU / 7, rr = r.r * (0.75 + 0.25 * ((i * 7) % 3) / 2); ctx.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#4a463d'; ctx.stroke(); }
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
      if (this.deployPhase) { ctx.fillStyle = 'rgba(60,110,230,0.13)'; ctx.fillRect(0, 0, 580, FH); ctx.strokeStyle = 'rgba(120,170,255,0.7)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(580, 0); ctx.lineTo(580, FH); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(200,220,255,0.8)'; ctx.font = 'bold 18px Georgia'; ctx.textAlign = 'center'; ctx.fillText('DEPLOYMENT ZONE', 290, 36); }
      // fallen
      for (const d of this.dead) { ctx.fillStyle = d[2] === 0 ? 'rgba(30,50,110,0.5)' : 'rgba(120,40,40,0.5)'; ctx.fillRect(d[0], d[1], 2, 2); }
      // order lines for selection
      ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
      for (const u of this.sel) if (u.order && u.order.type === 'move') { ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.order.x, u.order.y); ctx.stroke(); }
        else if (u.order && u.order.type === 'attack' && u.order.target) { ctx.strokeStyle = 'rgba(255,90,90,0.75)'; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.order.target.x, u.order.target.y); ctx.stroke(); }
      ctx.setLineDash([]);
      // units (routing first so living units draw on top)
      const sorted = this.units.filter((u) => !u.fled && (u.cls === 'gen' ? !u.dead : !u.dead)).sort((a, b) => (a.state === 'routing' ? 0 : 1) - (b.state === 'routing' ? 0 : 1));
      for (const u of sorted) this.drawUnit(ctx, u);
      // shots
      for (const s of this.shots) {
        const f = s.t / 0.35;
        if (s.art) { ctx.strokeStyle = `rgba(30,30,30,${1 - f})`; ctx.lineWidth = 1.5; const px = s.x0 + (s.x1 - s.x0) * Math.min(1, f * 1.6), py = s.y0 + (s.y1 - s.y0) * Math.min(1, f * 1.6); ctx.beginPath(); ctx.moveTo(px - (s.x1 - s.x0) * 0.04, py - (s.y1 - s.y0) * 0.04); ctx.lineTo(px, py); ctx.stroke(); }
        else { ctx.fillStyle = `rgba(255,240,180,${1 - f})`; for (let i = 0; i < 3; i++) { const q = (f + i * 0.12) % 1; ctx.fillRect(s.x0 + (s.x1 - s.x0) * q * 0.25 + i, s.y0 + (s.y1 - s.y0) * q * 0.25, 1.6, 1.6); } }
      }
      // smoke
      for (const p of this.puffs) { const f = p.t / p.life; ctx.fillStyle = p.c + (0.55 * (1 - f)).toFixed(3) + ')'; ctx.beginPath(); ctx.arc(p.x + f * 6, p.y - f * 8, p.r * (0.6 + f), 0, TAU); ctx.fill(); }
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
      ctx.rotate(u.facing);
      const w = u.w, d = u.d; // d along facing
      const flash = u.state === 'routing' && Math.floor(this.t * 4) % 2 === 0;
      let body = fc.color;
      ctx.globalAlpha = u.state === 'routing' ? 0.75 : 1;
      if (u.formation === 'skirmish') {
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-d / 2, -w / 2, d, w);
        ctx.fillStyle = body;
        const n = Math.max(6, Math.round(u.men / 40));
        for (let i = 0; i < n; i++) { const a = ((i * 97) % 100) / 100, b = ((i * 61) % 100) / 100; ctx.fillRect(-d / 2 + a * d, -w / 2 + b * w, 2.6, 2.6); }
        ctx.strokeStyle = this.sel.has(u) ? '#fff' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = this.sel.has(u) ? 2 : 1; ctx.strokeRect(-d / 2, -w / 2, d, w);
      } else {
        ctx.fillStyle = flash ? '#fff' : body;
        ctx.fillRect(-d / 2, -w / 2, d, w);
        // front edge
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(d / 2 - 2.2, -w / 2, 2.2, w);
        if (u.cls === 'cav') { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-d / 2 + 1, -w / 2 + 1); ctx.lineTo(d / 2 - 1, w / 2 - 1); ctx.stroke(); }
        if (u.cls === 'art') { ctx.fillStyle = '#111'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(2, i * (w / 3.5), 2.3, 0, TAU); ctx.fill(); ctx.fillRect(2, i * (w / 3.5) - 0.7, 8, 1.4); } }
        if (u.type === 'guard') { ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5; ctx.strokeRect(-d / 2 + 1, -w / 2 + 1, d - 2, w - 2); }
        if (u.formation === 'square') { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-d / 2, -w / 2); ctx.lineTo(d / 2, w / 2); ctx.moveTo(d / 2, -w / 2); ctx.lineTo(-d / 2, w / 2); ctx.stroke(); }
        ctx.strokeStyle = this.sel.has(u) ? '#fff' : 'rgba(0,0,0,0.75)'; ctx.lineWidth = this.sel.has(u) ? 2.4 : 1.1;
        ctx.strokeRect(-d / 2, -w / 2, d, w);
      }
      ctx.globalAlpha = 1;
      ctx.rotate(-u.facing);
      // morale bar
      const bw = Math.max(26, Math.min(w, d) + 8), my = -Math.max(w, d) / 2 - 7;
      const mp = clamp(u.morale / u.baseMorale, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, my, bw, 3.2);
      ctx.fillStyle = mp > 0.6 ? '#4c4' : mp > 0.3 ? '#ec3' : '#e44'; ctx.fillRect(-bw / 2, my, bw * mp, 3.2);
      const hp = clamp(u.men / u.max, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, my + 3.6, bw, 2.2);
      ctx.fillStyle = '#ddd'; ctx.fillRect(-bw / 2, my + 3.6, bw * hp, 2.2);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2.5; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const label = String(Math.round(u.men));
      ctx.strokeText(label, 0, Math.max(w, d) / 2 + 3); ctx.fillText(label, 0, Math.max(w, d) / 2 + 3);
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
          <div class="b-mid"><span id="b-time">0:00</span> &middot; <span id="b-terr"></span></div>
          <div class="b-side b-s1"><b id="b-n1"></b><div class="b-bar"><i id="b-f1"></i></div><span id="b-m1"></span></div>
        </div>
        <div class="b-stage" id="b-stage"><canvas id="b-canvas"></canvas>
          <div class="b-banner" id="b-banner"></div>
          <div class="b-feed" id="b-feed"></div>
          <div class="b-help" id="b-help">Left-click/drag: select &middot; Right-click: move/attack &middot; Right-drag: form a line &middot; Wheel: zoom &middot; WASD: pan &middot; Space: pause</div>
        </div>
        <div class="b-bottom">
          <div class="b-info" id="b-info">Select units</div>
          <div class="b-btns">
            <button data-f="line" title="Line (Q)">Line <kbd>Q</kbd></button>
            <button data-f="column" title="Column (W)">Column <kbd>W</kbd></button>
            <button data-f="square" title="Square (E)">Square <kbd>E</kbd></button>
            <button data-f="skirmish" title="Skirmish (R)">Skirmish <kbd>R</kbd></button>
            <button data-a="charge" title="Charge (X)">Charge <kbd>X</kbd></button>
            <button data-a="halt" title="Halt (H)">Halt <kbd>H</kbd></button>
            <button data-a="rally" id="b-rally" title="Rally (G)">Rally <kbd>G</kbd></button>
            <span class="b-sep"></span>
            <button data-a="pause" id="b-pause">&#9654; Start <kbd>Space</kbd></button>
            <button data-sp="1" class="b-sp on">1x</button><button data-sp="2" class="b-sp">2x</button><button data-sp="4" class="b-sp">4x</button>
            <span class="b-sep"></span>
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
      r.querySelector('#b-terr').textContent = `${this.spec.provName} · ${{ p: 'Plains', h: 'Hills', f: 'Forest', m: 'Mountains' }[this.spec.terrain]}${this.spec.fort ? ' · Fort ' + this.spec.fort : ''}`;
      r.querySelector('#b-banner').classList.add('deploy');
      r.querySelector('#b-banner').innerHTML = `<h2>Battle of ${this.spec.provName}</h2><p>${this.spec.playerIsAttacker ? 'You are attacking.' : 'You are defending.'} <b>Deploy:</b> select units and right-click (or right-drag a line) to place them in the shaded zone, change formations with Q/W/E/R, then press <b>Space</b> to begin.</p>`;
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
        if (this.rdrag) {
          const w = this.toWorld(p.x, p.y);
          if (Math.hypot(p.x - this.rdrag.sx, p.y - this.rdrag.sy) > 18) this.lineDrag = { p0: this.rdrag.p0, p1: w };
        }
        if (this.pan) { const k = this.fit * this.cam.z / devicePixelRatio; this.cam.x = this.pan.cx - (e.clientX - this.pan.x) / k; this.cam.y = this.pan.cy - (e.clientY - this.pan.y) / k; }
      });
      window.addEventListener('mouseup', this.mu = (e) => {
        if (!this.canvas.isConnected) return;
        const p = pos(e);
        if (e.button === 0 && this.box) {
          const b = this.box; this.box = null;
          if (Math.hypot(b.x1 - b.x0, b.y1 - b.y0) < 5) this.clickSelect(p, b.shift, e.detail >= 2);
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
        const before = this.toWorld(pos(e).x, pos(e).y);
        this.cam.z = clamp(this.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.6, 3.5);
        const after = this.toWorld(pos(e).x, pos(e).y);
        this.cam.x += before.x - after.x; this.cam.y += before.y - after.y;
      }, { passive: false });
      window.addEventListener('keydown', this.kd = (e) => {
        if (!this.canvas.isConnected) return;
        if (e.target && /input|textarea/i.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        this.keys[k] = true;
        if (k === ' ') { this.togglePause(); e.preventDefault(); }
        else if (k === 'q') this.setForm('line'); else if (k === 'w' && !e.ctrlKey) this.setForm('column');
        else if (k === 'e') this.setForm('square'); else if (k === 'r') this.setForm('skirmish');
        else if (k === 'x') this.doCharge(); else if (k === 'h') this.halt(); else if (k === 'g') this.rally();
        else if (k === 'escape') { this.sel.clear(); this.updateInfo(); }
        else if (k === 'a' && e.ctrlKey) { this.units.filter((u) => u.side === 0 && this.alive(u)).forEach((u) => this.sel.add(u)); e.preventDefault(); this.updateInfo(); }
        else if (k === '+' || k === '=') this.setSpeed(Math.min(4, this.speed * 2)); else if (k === '-') this.setSpeed(Math.max(1, this.speed / 2));
        else if (k === 'tab') { e.preventDefault(); }
      });
      window.addEventListener('keyup', this.ku = (e) => { this.keys[e.key.toLowerCase()] = false; });
      r.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.f) this.setForm(b.dataset.f);
        else if (b.dataset.sp) this.setSpeed(+b.dataset.sp);
        else if (b.dataset.a === 'pause') this.togglePause();
        else if (b.dataset.a === 'charge') this.doCharge();
        else if (b.dataset.a === 'halt') this.halt();
        else if (b.dataset.a === 'rally') this.rally();
        else if (b.dataset.a === 'withdraw') this.withdraw();
      }));
    }

    clickSelect(p, add, dbl) {
      const w = this.toWorld(p.x, p.y);
      let hit = null, bd = 1e9;
      for (const u of this.units) {
        if (u.side !== 0 || (u.cls !== 'gen' && !this.alive(u)) || u.dead || u.fled) continue;
        const d = u.cls === 'gen' ? Math.hypot(u.x - w.x, u.y - w.y) - 4 : this.pointGap(u, w);
        if (d < 6 && d < bd) { bd = d; hit = u; }
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
    togglePause() {
      if (this.over) return;
      this.paused = !this.paused;
      if (!this.paused) this.deployPhase = false;
      this.root.querySelector('#b-pause').innerHTML = this.paused ? '&#9654; Resume <kbd>Space</kbd>' : '&#10074;&#10074; Pause <kbd>Space</kbd>';
      this.root.querySelector('#b-banner').classList.toggle('hide', !this.paused ? true : this.t > 0);
      this.root.querySelector('#b-help').classList.add('hide');
    }
    setSpeed(s) { this.speed = s; this.root.querySelectorAll('.b-sp').forEach((b) => b.classList.toggle('on', +b.dataset.sp === s)); }
    withdraw() {
      if (this.over) return;
      if (!confirm('Withdraw from the field? Your army will suffer heavily and the battle is lost.')) return;
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
      // camera keys
      const ks = 520 * dt / this.cam.z;
      if (this.keys.a && !this.keys.control) this.cam.x -= ks; if (this.keys.d) this.cam.x += ks;
      if (this.keys.arrowleft) this.cam.x -= ks; if (this.keys.arrowright) this.cam.x += ks;
      if (this.keys.arrowup) this.cam.y -= ks; if (this.keys.arrowdown) this.cam.y += ks;
      if (this.keys.s) this.cam.y += ks; if (this.keys.w && false) this.cam.y -= ks;
      this.cam.x = clamp(this.cam.x, 0, FW); this.cam.y = clamp(this.cam.y, 0, FH);
      if (!this.paused && !this.over) {
        this.acc += dt * this.speed;
        let n = 0;
        while (this.acc >= 0.05 && n++ < 40) { this.step(0.05); this.acc -= 0.05; }
      }
      this.draw();
      this.hud();
      this.raf = requestAnimationFrame((t) => this.frame(t));
    }

    hud() {
      const r = this.root;
      for (const s of [0, 1]) {
        const tot = this.totalMen(s), init = this.initialMen[s] || 1;
        r.querySelector('#b-f' + s).style.width = clamp((tot / init) * 100, 0, 100) + '%';
        r.querySelector('#b-m' + s).textContent = `${Math.round(tot)} / ${init}`;
      }
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
      b.classList.remove('hide', 'deploy');
      const win = winner === 0;
      b.innerHTML = `<h2 class="${win ? 'good' : 'bad'}">${win ? 'Victory!' : 'Defeat'}</h2>
        <p>Your losses: <b>${Math.round(cas[0])}</b> &middot; Enemy losses: <b>${Math.round(cas[1])}</b></p>
        <button id="b-cont" class="primary">Continue</button>`;
      b.querySelector('#b-cont').addEventListener('click', () => this.close());
    }

    close() {
      this.stopped = true;
      cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this.onResize);
      if (this.ro) this.ro.disconnect();
      window.removeEventListener('mousemove', this.mm); window.removeEventListener('mouseup', this.mu);
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
