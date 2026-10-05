/* NAPWORLD - world generation (province raster from coastline polygons) and map rendering */
(function () {
  const NAP = window.NAP;
  const { W, H, cs } = NAP.MAP;
  const gw = Math.ceil(W / cs), gh = Math.ceil(H / cs);

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  NAP.hexToRgb = hexToRgb;

  // Coast detail: projected points get seeded midpoint displacement (natural wobble) then Chaikin smoothing
  const coastCache = new WeakMap();
  function coastPts(flat) {
    let r = coastCache.get(flat); if (r) return r;
    let pts = []; for (let i = 0; i < flat.length; i += 2) pts.push(NAP.proj(flat[i], flat[i + 1]));
    let seed = 1234567 + flat.length * 31; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
    for (let pass = 0; pass < 3; pass++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        out.push(a);
        if (len > 4) { const k = rnd() * 0.3 * len * (pass === 0 ? 1 : pass === 1 ? 0.6 : 0.4); out.push([(a[0] + b[0]) / 2 - dy / len * k, (a[1] + b[1]) / 2 + dx / len * k]); }
      }
      pts = out;
    }
    for (let pass = 0; pass < 3; pass++) { // Chaikin corner cutting
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      pts = out;
    }
    coastCache.set(flat, pts); return pts;
  }
  function polyPath(ctx, flat, scale) {
    ctx.beginPath();
    const pts = coastPts(flat);
    for (let i = 0; i < pts.length; i++) { if (i === 0) ctx.moveTo(pts[i][0] * scale, pts[i][1] * scale); else ctx.lineTo(pts[i][0] * scale, pts[i][1] * scale); }
    ctx.closePath();
  }

  // Binary min-heap on (cost, index)
  class Heap {
    constructor() { this.c = []; this.v = []; }
    push(cost, val) {
      const c = this.c, v = this.v; let i = c.length;
      c.push(cost); v.push(val);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (c[p] <= cost) break;
        c[i] = c[p]; v[i] = v[p]; i = p;
      }
      c[i] = cost; v[i] = val;
    }
    pop() {
      const c = this.c, v = this.v;
      const rv = v[0];
      const lc = c.pop(), lv = v.pop();
      const n = c.length;
      if (n > 0) {
        let i = 0;
        for (;;) {
          let l = 2 * i + 1;
          if (l >= n) break;
          if (l + 1 < n && c[l + 1] < c[l]) l++;
          if (c[l] >= lc) break;
          c[i] = c[l]; v[i] = v[l]; i = l;
        }
        c[i] = lc; v[i] = lv;
      }
      return rv;
    }
    get size() { return this.c.length; }
  }

  NAP.buildWorld = function () {
    const defs = NAP.PROVINCE_DEFS;
    // 1. Land mask from vector coastlines
    const mc = document.createElement('canvas'); mc.width = gw; mc.height = gh;
    const mx = mc.getContext('2d', { willReadFrequently: true });
    const names = Object.keys(NAP.LAND);
    names.forEach((n, i) => {
      mx.fillStyle = `rgb(${i + 1},0,0)`;
      polyPath(mx, NAP.LAND[n], 1 / cs);
      mx.fill();
    });
    const img = mx.getImageData(0, 0, gw, gh).data;
    const land = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) land[i] = img[i * 4 + 3] >= 128 ? Math.max(1, img[i * 4]) : 0;

    // 2. Seeds (snap to land)
    const N = defs.length;
    const seeds = defs.map((d) => {
      const [x, y] = NAP.proj(d.lon, d.lat);
      let sx = Math.round(x / cs), sy = Math.round(y / cs);
      if (!land[sy * gw + sx]) {
        let found = false;
        for (let r = 1; r < 30 && !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
            const px = sx + dx, py = sy + dy;
            if (px >= 0 && py >= 0 && px < gw && py < gh && land[py * gw + px]) { sx = px; sy = py; found = true; }
          }
        }
        if (!found) console.warn('seed not on land', d.id);
      }
      return [sx, sy];
    });

    // rivers and mountain ridges are costly to cross, so province borders tend to follow them
    const bar = new Float32Array(gw * gh);
    {
      const bc = document.createElement('canvas'); bc.width = gw; bc.height = gh;
      const bx = bc.getContext('2d', { willReadFrequently: true });
      const trace = (lines, lw, ch) => {
        bx.clearRect(0, 0, gw, gh); bx.strokeStyle = '#f00'; bx.lineWidth = lw; bx.lineJoin = 'round';
        for (const r of lines) { bx.beginPath(); r.forEach((pt, i) => { const [x, y] = NAP.proj(pt[0], pt[1]); if (i) bx.lineTo(x / cs, y / cs); else bx.moveTo(x / cs, y / cs); }); bx.stroke(); }
        const d = bx.getImageData(0, 0, gw, gh).data;
        for (let i = 0; i < gw * gh; i++) if (d[i * 4 + 3] > 90) bar[i] += ch;
      };
      trace(NAP.RIVERS || [], 1.8, 5);
      trace(NAP.MOUNTAINS || [], 2.6, 1.2);
    }
    // 3. Geodesic Voronoi via Dijkstra across land pixels
    const pg = new Uint16Array(gw * gh);
    const dist = new Float32Array(gw * gh).fill(1e9);
    const heap = new Heap();
    seeds.forEach(([sx, sy], i) => { const idx = sy * gw + sx; dist[idx] = 0; pg[idx] = i + 1; heap.push(0, idx); });
    const nb = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[-1,1,1.414],[1,-1,1.414],[-1,-1,1.414]];
    while (heap.size) {
      const idx = heap.pop();
      const d0 = dist[idx];
      const x = idx % gw, y = (idx / gw) | 0;
      const o = pg[idx];
      for (let k = 0; k < 8; k++) {
        const nx = x + nb[k][0], ny = y + nb[k][1];
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const ni = ny * gw + nx;
        if (!land[ni]) continue;
        const nd = d0 + nb[k][2] * (1 + bar[ni]);
        if (nd < dist[ni]) { dist[ni] = nd; pg[ni] = o; heap.push(nd, ni); }
      }
    }

    // 4. Province metrics: area, centroid, bbox, adjacency
    const area = new Float64Array(N + 1), sxs = new Float64Array(N + 1), sys = new Float64Array(N + 1);
    const adjSet = defs.map(() => new Set());
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x, p = pg[i];
      if (!p) continue;
      area[p]++; sxs[p] += x; sys[p] += y;
      if (x + 1 < gw) { const q = pg[i + 1]; if (q && q !== p) { adjSet[p - 1].add(q - 1); adjSet[q - 1].add(p - 1); } }
      if (y + 1 < gh) {
        const q = pg[i + gw]; if (q && q !== p) { adjSet[p - 1].add(q - 1); adjSet[q - 1].add(p - 1); }
        if (x + 1 < gw) { const q2 = pg[i + gw + 1]; if (q2 && q2 !== p) { adjSet[p - 1].add(q2 - 1); adjSet[q2 - 1].add(p - 1); } }
        if (x > 0) { const q3 = pg[i + gw - 1]; if (q3 && q3 !== p) { adjSet[p - 1].add(q3 - 1); adjSet[q3 - 1].add(p - 1); } }
      }
    }
    // label anchor: pixel in province nearest to centroid
    const anchor = defs.map((_, i) => [sxs[i + 1] / (area[i + 1] || 1), sys[i + 1] / (area[i + 1] || 1)]);
    const best = new Float64Array(N + 1).fill(1e18);
    const bestPx = defs.map(() => [0, 0]);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const p = pg[y * gw + x]; if (!p) continue;
      const dx = x - anchor[p - 1][0], dy = y - anchor[p - 1][1], d = dx * dx + dy * dy;
      if (d < best[p]) { best[p] = d; bestPx[p - 1] = [x, y]; }
    }
    const provs = defs.map((d, i) => ({
      ...d, idx: i, area: area[i + 1],
      cx: bestPx[i][0] * cs + cs / 2, cy: bestPx[i][1] * cs + cs / 2,
      adj: [...adjSet[i]]
    }));
    const byId = {}; provs.forEach((p) => (byId[p.id] = p));

    // 5. Sea links
    const seaAdj = provs.map(() => new Set());
    NAP.SEA_ZONES.forEach((z) => {
      const ps = z.ports.map((id) => byId[id]).filter((p) => p && p.port);
      for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) {
        const dx = ps[a].cx - ps[b].cx, dy = ps[a].cy - ps[b].cy;
        if (Math.hypot(dx, dy) <= z.range && !ps[a].adj.includes(ps[b].idx)) {
          seaAdj[ps[a].idx].add(ps[b].idx); seaAdj[ps[b].idx].add(ps[a].idx);
        }
      }
    });
    provs.forEach((p) => (p.sea = [...seaAdj[p.idx]]));

    const world = { gw, gh, pg, land, provs, byId, N };
    NAP.world = world;
    world.provAt = (wx, wy) => {
      const x = Math.floor(wx / cs), y = Math.floor(wy / cs);
      if (x < 0 || y < 0 || x >= gw || y >= gh) return null;
      const p = pg[y * gw + x];
      return p ? provs[p - 1] : null;
    };
    // Smooth vector province borders: trace the pixel boundaries into chains, then round them off.
    // Chains run between junctions (whose points stay fixed), so neighbouring provinces share one edge with no gaps.
    {
      const V = gw + 1, ex = [], adj = new Map();
      const addE = (x1, y1, x2, y2, a, b) => { const i = ex.length; ex.push([x1, y1, x2, y2, a, b]); for (const k of [y1 * V + x1, y2 * V + x2]) { let l = adj.get(k); if (!l) adj.set(k, (l = [])); l.push(i); } };
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const pp = pg[y * gw + x]; if (!pp) continue;
        if (x + 1 < gw) { const q = pg[y * gw + x + 1]; if (q && q !== pp) addE(x + 1, y, x + 1, y + 1, pp, q); }
        if (y + 1 < gh) { const q = pg[(y + 1) * gw + x]; if (q && q !== pp) addE(x, y + 1, x + 1, y + 1, pp, q); }
      }
      const used = new Uint8Array(ex.length), chains = [];
      const other = (e, k) => { const t = ex[e]; return t[1] * V + t[0] === k ? t[3] * V + t[2] : t[1] * V + t[0]; };
      const walk = (k0, e0) => {
        const pts = [k0]; let k = k0, e = e0;
        for (;;) {
          used[e] = 1; k = other(e, k); pts.push(k);
          const l = adj.get(k);
          if (l.length !== 2 || k === k0) break;
          const ne = l[0] === e ? l[1] : l[0]; if (used[ne]) break; e = ne;
        }
        return { pts: pts.map((q) => [(q % V), Math.floor(q / V)]), a: ex[e0][4], b: ex[e0][5], closed: pts[0] === pts[pts.length - 1] };
      };
      for (const [k, l] of adj) if (l.length !== 2) for (const e of l) if (!used[e]) chains.push(walk(k, e));
      for (let e = 0; e < ex.length; e++) if (!used[e]) { const t = ex[e]; chains.push(walk(t[1] * V + t[0], e)); }
      const smooth = (c) => {
        let P = c.pts; const n0 = P.length; if (n0 < 3) return P.map((q) => [q[0] * cs, q[1] * cs]);
        if (c.closed) P = P.slice(0, -1);
        for (let pass = 0; pass < 3; pass++) {
          const n = P.length, R = [];
          for (let i = 0; i < n; i++) {
            if (!c.closed && (i === 0 || i === n - 1)) { R.push(P[i]); continue; }
            const a = P[(i + n - 1) % n], b = P[i], d = P[(i + 1) % n];
            R.push([a[0] * 0.25 + b[0] * 0.5 + d[0] * 0.25, a[1] * 0.25 + b[1] * 0.5 + d[1] * 0.25]);
          }
          P = R;
        }
        for (let pass = 0; pass < 2; pass++) {
          const n = P.length, R = c.closed ? [] : [P[0]];
          for (let i = 0; i < (c.closed ? n : n - 1); i++) { const a = P[i], b = P[(i + 1) % n]; R.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
          if (!c.closed) R.push(P[n - 1]);
          P = R;
        }
        if (c.closed) P.push(P[0]);
        return P.map((q) => [q[0] * cs, q[1] * cs]);
      };
      world.chains = chains.map((c) => ({ a: c.a, b: c.b, pts: smooth(c), closed: c.closed }));
    }
    // Colour layer cache
    world.colorCanvas = document.createElement('canvas');
    world.colorCanvas.width = gw; world.colorCanvas.height = gh;
    world.hlCache = {};
    return world;
  };

  // ---------- Rendering ----------
  const TERRAIN_TINT = { p: [0, 0, 0], h: [-10, -10, -12], f: [-18, -8, -18], m: [-26, -24, -24] };

  // Recolour provinces by owner (call whenever ownership changes)
  NAP.recolor = function (state) {
    const w = NAP.world; if (!w) return;
    const ctx = w.colorCanvas.getContext('2d');
    const id = ctx.createImageData(gw, gh);
    const d = id.data;
    const provRGB = w.provs.map((p) => {
      const own = state.provinces[p.id].owner;
      const c = hexToRgb(NAP.FACTIONS[own].color);
      const t = TERRAIN_TINT[p.terrain];
      // Blend with parchment so the map stays readable
      const mix = 0.62;
      return [0, 1, 2].map((k) => Math.max(0, Math.min(255, Math.round(c[k] * mix + [226, 214, 182][k] * (1 - mix) + t[k]))));
    });
    const ownerIdx = w.provs.map((p) => state.provinces[p.id].owner);
    const pg = w.pg;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x, p = pg[i];
      if (!p) continue;
      let r, g, b;
      [r, g, b] = provRGB[p - 1];
      // subtle noise for a paper look
      const n = ((x * 73856093) ^ (y * 19349663)) & 7;
      r += n - 3; g += n - 3; b += n - 3;
      const o = i * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    w.hlCache = {};
    // vector borders: provincial (same owner) and national (owner changes)
    const prov = new Path2D(), nat = new Path2D();
    for (const c of w.chains) {
      const path = ownerIdx[c.a - 1] !== ownerIdx[c.b - 1] ? nat : prov;
      c.pts.forEach((q, i) => { if (i) path.lineTo(q[0], q[1]); else path.moveTo(q[0], q[1]); });
    }
    w.borderProv = prov; w.borderNat = nat;
  };

  // Highlight overlay for a set of provinces
  function hlCanvas(ids, rgba) {
    const w = NAP.world;
    const key = ids.join(',') + rgba;
    if (w.hlCache[key]) return w.hlCache[key];
    const c = document.createElement('canvas'); c.width = gw; c.height = gh;
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(gw, gh), d = id.data;
    const set = new Set(ids.map((s) => w.byId[s].idx + 1));
    const col = rgba;
    for (let i = 0; i < gw * gh; i++) {
      if (set.has(w.pg[i])) { d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = col[3]; }
    }
    ctx.putImageData(id, 0, 0);
    w.hlCache[key] = c;
    return c;
  }

  let oceanPattern = null;
  function ocean(ctx) {
    if (oceanPattern) return oceanPattern;
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#7fa6b8'; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(255,255,255,0.10)'; x.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const px = (i * 37) % 64, py = (i * 23 + 9) % 64;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 6, py - 4, px + 12, py); x.stroke();
    }
    oceanPattern = ctx.createPattern(c, 'repeat');
    return oceanPattern;
  }

  const FLAG_TEXT = { france: '#fff', britain: '#fff', austria: '#222', prussia: '#fff', russia: '#fff', ottoman: '#fff', spain: '#222', portugal: '#fff', sweden: '#fff', denmark: '#fff', naples: '#222', bavaria: '#222', minor: '#fff' };

  // opts: {selProv, targets:[ids], selArmy, armies, state, pathProvs, hoverProv}
  NAP.drawMap = function (ctx, cam, vw, vh, state, opts) {
    const w = NAP.world;
    ctx.save();
    ctx.fillStyle = '#7fa6b8'; ctx.fillRect(0, 0, vw, vh);
    ctx.translate(vw / 2 - cam.x * cam.z, vh / 2 - cam.y * cam.z);
    ctx.scale(cam.z, cam.z);
    // ocean texture
    ctx.fillStyle = ocean(ctx);
    ctx.fillRect(-200, -200, W + 400, H + 400);
    // pale shallows hugging the coast, like an engraved chart
    ctx.save(); ctx.lineJoin = 'round';
    for (const [lw, al] of [[11, 0.10], [7, 0.12], [3.5, 0.16]]) { ctx.strokeStyle = `rgba(235,246,250,${al})`; ctx.lineWidth = lw; for (const n in NAP.LAND) { polyPath(ctx, NAP.LAND[n], 1); ctx.stroke(); } }
    ctx.restore();
    // coast shadow
    ctx.save();
    ctx.shadowColor = 'rgba(30,60,80,0.55)'; ctx.shadowBlur = 10 * cam.z; ctx.fillStyle = '#d9cfb0';
    for (const n in NAP.LAND) { polyPath(ctx, NAP.LAND[n], 1); ctx.fill(); }
    ctx.restore();
    // province colours clipped to land
    ctx.save();
    ctx.beginPath();
    for (const n in NAP.LAND) {
      const pts = coastPts(NAP.LAND[n]);
      for (let i = 0; i < pts.length; i++) { if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]); else ctx.lineTo(pts[i][0], pts[i][1]); }
      ctx.closePath();
    }
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(w.colorCanvas, 0, 0, gw * cs, gh * cs);
    // highlight layers
    if (opts.hoverProv) ctx.drawImage(hlCanvas([opts.hoverProv], [255, 255, 255, 50]), 0, 0, gw * cs, gh * cs);
    if (opts.targets && opts.targets.length) ctx.drawImage(hlCanvas(opts.targets, [255, 240, 120, 70]), 0, 0, gw * cs, gh * cs);
    if (opts.selProv) ctx.drawImage(hlCanvas([opts.selProv], [255, 255, 255, 95]), 0, 0, gw * cs, gh * cs);
    { const mo = state.month, tint = (mo === 12 || mo <= 2) ? 'rgba(235,243,255,0.30)' : mo === 3 ? 'rgba(235,243,255,0.10)' : (mo === 10 || mo === 11) ? 'rgba(200,120,40,0.10)' : (mo >= 7 && mo <= 8) ? 'rgba(255,220,120,0.06)' : null;
      if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, gw * cs, gh * cs); } }
    // smooth vector borders (inside the land clip)
    { const lw = Math.max(0.7, 1.6 / Math.sqrt(cam.z));
      if (w.borderProv) {
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(60,45,30,0.38)'; ctx.lineWidth = lw; ctx.stroke(w.borderProv);
        ctx.strokeStyle = 'rgba(24,20,16,0.88)'; ctx.lineWidth = lw * 1.9; ctx.stroke(w.borderNat);
        const hl = [opts.selProv, opts.hoverProv].filter(Boolean);
        for (const [pid, col, k] of [[opts.hoverProv, 'rgba(255,255,255,0.55)', 1.6], [opts.selProv, 'rgba(255,255,255,0.95)', 2.4]]) {
          if (!pid) continue; const idx = w.byId[pid].idx + 1, hp = new Path2D();
          for (const c of w.chains) if (c.a === idx || c.b === idx) c.pts.forEach((q, i) => { if (i) hp.lineTo(q[0], q[1]); else hp.moveTo(q[0], q[1]); });
          ctx.strokeStyle = col; ctx.lineWidth = lw * k; ctx.stroke(hp);
        }
      }
    }
    ctx.restore();
    // coast line
    ctx.strokeStyle = 'rgba(40,35,25,0.9)'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
    for (const n in NAP.LAND) { polyPath(ctx, NAP.LAND[n], 1); ctx.stroke(); }
    // rivers
    ctx.strokeStyle = 'rgba(80,130,170,0.85)'; ctx.lineWidth = 1.3;
    for (const r of NAP.RIVERS) {
      ctx.beginPath();
      r.forEach((pt, i) => { const [x, y] = NAP.proj(pt[0], pt[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
    }
    // mountains
    ctx.fillStyle = 'rgba(95,80,60,0.75)';
    ctx.strokeStyle = 'rgba(40,30,20,0.6)'; ctx.lineWidth = 0.6;
    if (!NAP._mtn) {
      NAP._mtn = [];
      let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const line of NAP.MOUNTAINS) {
        for (let i = 0; i + 1 < line.length; i++) {
          const [x0, y0] = NAP.proj(line[i][0], line[i][1]), [x1, y1] = NAP.proj(line[i + 1][0], line[i + 1][1]);
          const len = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(len / 9);
          for (let k = 0; k < n; k++) {
            const t = k / n;
            NAP._mtn.push([x0 + (x1 - x0) * t + (rnd() - 0.5) * 10, y0 + (y1 - y0) * t + (rnd() - 0.5) * 10, 4 + rnd() * 4]);
          }
        }
      }
    }
    for (const [x, y, s] of NAP._mtn) {
      ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x, y - s); ctx.lineTo(x + s, y + s * 0.6); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    // sea labels
    ctx.font = 'italic 12px "IM Fell English", Georgia, serif'; ctx.fillStyle = 'rgba(30,60,90,0.55)'; ctx.textAlign = 'center';
    for (const [t, lo, la] of NAP.SEA_LABELS) { const [x, y] = NAP.proj(lo, la); ctx.save(); ctx.translate(x, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'; ctx.fillText(t, 0, 0); ctx.restore(); }
    // sea links from the selected army's port
    if (opts.seaFrom) {
      const p = w.byId[opts.seaFrom];
      ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6;
      for (const q of p.sea) { const o = w.provs[q]; ctx.beginPath(); ctx.moveTo(p.cx, p.cy); ctx.lineTo(o.cx, o.cy); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    // province labels
    if (cam.z > 0.8) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of w.provs) {
        const fs = Math.max(7, Math.min(13, 4 + Math.sqrt(p.area) / 5));
        if (fs * cam.z < 7.5) continue;
        ctx.font = `${fs}px "IM Fell English", Georgia, serif`;
        ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(240,232,205,0.8)';
        ctx.strokeText(p.name, p.cx, p.cy - 10);
        ctx.fillStyle = '#2a2118'; ctx.fillText(p.name, p.cx, p.cy - 10);
      }
    }
    // province icons
    for (const p of w.provs) {
      const ps = state.provinces[p.id];
      let ix = p.cx - 9, iy = p.cy + 4;
      ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (p.capital) { ctx.fillStyle = '#ffd700'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.8; ctx.strokeText('★', p.cx, p.cy - 1); ctx.fillText('★', p.cx, p.cy - 1); }
      if (cam.z > 0.8) {
        let x = p.cx - 8;
        if (p.port) { ctx.fillStyle = '#123'; ctx.fillText('⚓', x, p.cy + 13); x += 11; }
        if (ps.fort > 0) { ctx.fillStyle = '#322'; ctx.fillText('♖'.repeat(Math.min(3, ps.fort)), x + 4, p.cy + 13); }
      }
      if (ps.siege) { ctx.fillStyle = '#c00'; ctx.fillText('⚔', p.cx + 14, p.cy - 1); }
    }
    // path of selected army
    if (opts.pathProvs && opts.pathProvs.length > 1) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      opts.pathProvs.forEach((id, i) => { const p = w.byId[id]; if (i) ctx.lineTo(p.cx, p.cy); else ctx.moveTo(p.cx, p.cy); });
      ctx.stroke(); ctx.setLineDash([]);
      const last = w.byId[opts.pathProvs[opts.pathProvs.length - 1]];
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(last.cx, last.cy, 4, 0, 7); ctx.fill();
    }
    if (opts.supplyPaths && opts.supplyPaths.length) {
      ctx.strokeStyle = 'rgba(230,140,40,0.95)'; ctx.lineWidth = 2.2; ctx.setLineDash([2, 5]);
      for (const sp of opts.supplyPaths) { ctx.beginPath(); sp.forEach((id, i) => { const q = w.byId[id]; if (i) ctx.lineTo(q.cx, q.cy); else ctx.moveTo(q.cx, q.cy); }); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    if (opts.pulse && w.byId[opts.pulse]) {
      const pp = w.byId[opts.pulse], k = (performance.now() % 1200) / 1200;
      ctx.strokeStyle = `rgba(255,224,90,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pp.cx, pp.cy, 12 + 34 * k, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,224,90,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pp.cx, pp.cy, 11, 0, 7); ctx.stroke();
    }
    // army markers
    opts.markers = [];
    const byProv = {};
    for (const a of state.armies) (byProv[a.prov] = byProv[a.prov] || []).push(a);
    const sc = Math.max(0.75, Math.min(1.3, 1 / Math.sqrt(cam.z)));
    for (const pid in byProv) {
      const p = w.byId[pid], list = byProv[pid];
      list.forEach((a, i) => {
        const x = p.cx + 8 + i * 22 * sc, y = p.cy + 24 * sc - (i % 2) * 3;
        const fc = NAP.FACTIONS[a.owner];
        const mw = 20 * sc, mh = 14 * sc;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = fc.color; ctx.strokeStyle = a.id === opts.selArmy ? '#fff' : '#111';
        ctx.lineWidth = a.id === opts.selArmy ? 2.2 : 1.2;
        ctx.fillRect(-mw / 2, -mh / 2, mw, mh); ctx.strokeRect(-mw / 2, -mh / 2, mw, mh);
        ctx.fillStyle = FLAG_TEXT[a.owner] || '#fff';
        ctx.font = `bold ${9 * sc}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(a.units.length, 0, 0.5);
        if (a.general) { ctx.fillStyle = '#ffd700'; ctx.font = `${8 * sc}px sans-serif`; ctx.fillText('★', mw / 2, -mh / 2); }
        if (a.owner === state.player && a.path && a.path.length) { ctx.fillStyle = '#fff'; ctx.fillText('→', mw / 2 + 4 * sc, 0); }
        ctx.restore();
        opts.markers.push({ id: a.id, x, y, w: mw, h: mh });
      });
    }
    // move arrows while a nation's turn is being played back
    if (opts.moveArrows) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const m of opts.moveArrows) {
        const a = w.byId[m.from], b = w.byId[m.to], ang = Math.atan2(b.cy - a.cy, b.cx - a.cx), hs = 11;
        for (const [col, lw] of [['#fff', 7], [m.color, 4]]) {
          ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.moveTo(a.cx, a.cy); ctx.lineTo(b.cx - Math.cos(ang) * 6, b.cy - Math.sin(ang) * 6); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(b.cx, b.cy); ctx.lineTo(b.cx - Math.cos(ang - 0.45) * hs * (lw / 4), b.cy - Math.sin(ang - 0.45) * hs * (lw / 4)); ctx.lineTo(b.cx - Math.cos(ang + 0.45) * hs * (lw / 4), b.cy - Math.sin(ang + 0.45) * hs * (lw / 4)); ctx.closePath(); ctx.fill();
        }
      }
      ctx.restore();
    }
    // fleets: docked ones sit left of the port, those at sea at the centre of their zone
    const fl = state.fleets || [], slots = {};
    NAP.zonePos = (i) => NAP.proj(NAP.SEA_ZONES[i].c[0], NAP.SEA_ZONES[i].c[1]);
    const fleetPos = (f) => {
      if (f.port) { const p = w.byId[f.port]; return [p.cx, p.cy]; }
      const [zx, zy] = NAP.zonePos(f.zone); return [zx, zy];
    };
    if (opts.selFleet) {
      const sf = opts.selFleet; ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      NAP.SEA_ZONES.forEach((z, i) => { const [zx, zy] = NAP.zonePos(i); ctx.beginPath(); ctx.arc(zx, zy, 34, 0, 7); ctx.fill(); ctx.stroke(); });
      ctx.setLineDash([]);
      if (sf.path && sf.path.length) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]); ctx.beginPath();
        const [sx, sy] = fleetPos(sf); ctx.moveTo(sx, sy);
        for (const n of sf.path) { const [k, v] = n.split(':'); const q = k === 'z' ? NAP.zonePos(+v) : [w.byId[v].cx, w.byId[v].cy]; ctx.lineTo(q[0], q[1]); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
    }
    for (const f of fl) {
      const key = f.port ? 'p' + f.port : 'z' + f.zone, i = slots[key] = (slots[key] || 0) + 1, [bx, by] = fleetPos(f);
      const x = f.port ? bx - 20 * sc - (i - 1) * 28 * sc : bx + (i - 1) * 30 * sc - 8, y = f.port ? by + 26 * sc : by;
      const fc = NAP.FACTIONS[f.owner], sel = opts.selFleet && opts.selFleet.id === f.id, mw = 27 * sc, mh = 17 * sc, n = (f.ships.sol || 0) + (f.ships.frigate || 0);
      ctx.save(); ctx.translate(x, y);
      // hull
      ctx.fillStyle = fc.color; ctx.strokeStyle = sel ? '#fff' : '#111'; ctx.lineWidth = sel ? 2.2 : 1.2;
      ctx.beginPath(); ctx.moveTo(-mw / 2, -mh / 4); ctx.lineTo(mw / 2, -mh / 4); ctx.lineTo(mw / 2 - 4 * sc, mh / 2); ctx.lineTo(-mw / 2 + 4 * sc, mh / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      // mast and sail
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -mh / 4); ctx.lineTo(0, -mh * 0.95); ctx.stroke();
      ctx.fillStyle = '#f4f0e0'; ctx.beginPath(); ctx.moveTo(0, -mh * 0.9); ctx.lineTo(mw * 0.32, -mh * 0.35); ctx.lineTo(0, -mh * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = FLAG_TEXT[f.owner] || '#fff'; ctx.font = `bold ${8 * sc}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, 0, mh * 0.12);
      if (f.owner === state.player && f.path && f.path.length) { ctx.fillStyle = '#fff'; ctx.fillText('\u2192', mw / 2 + 4 * sc, 0); }
      ctx.restore();
      opts.markers.push({ kind: 'fleet', id: f.id, x, y, w: mw, h: mh * 1.4 });
    }
    // blockaded ports
    for (const p of w.provs) { if (state.provinces[p.id].blockade) { ctx.save(); ctx.strokeStyle = '#e33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.cx, p.cy, 9, 0, 7); ctx.moveTo(p.cx - 6, p.cy - 6); ctx.lineTo(p.cx + 6, p.cy + 6); ctx.stroke(); ctx.restore(); } }
    ctx.restore();
  };
})();
