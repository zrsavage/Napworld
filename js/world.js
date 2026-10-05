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

  function polyPath(ctx, flat, scale) {
    ctx.beginPath();
    for (let i = 0; i < flat.length; i += 2) {
      const [x, y] = NAP.proj(flat[i], flat[i + 1]);
      if (i === 0) ctx.moveTo(x * scale, y * scale); else ctx.lineTo(x * scale, y * scale);
    }
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
      // borders
      const right = x + 1 < gw ? pg[i + 1] : 0, down = y + 1 < gh ? pg[i + gw] : 0;
      const left = x > 0 ? pg[i - 1] : 0, up = y > 0 ? pg[i - gw] : 0;
      let border = 0; // 0 none, 1 provincial, 2 national, 3 coast
      const chk = (q) => {
        if (q === p) return;
        if (!q) border = Math.max(border, 3);
        else if (ownerIdx[q - 1] !== ownerIdx[p - 1]) border = Math.max(border, 2);
        else border = Math.max(border, 1);
      };
      chk(right); chk(down); chk(left); chk(up);
      if (border === 1 && (right !== p && right || down !== p && down)) { r *= 0.78; g *= 0.78; b *= 0.78; }
      else if (border === 1) { /* only left/up neighbour differs: skip to keep lines thin */ }
      else if (border === 2) { r = 28; g = 24; b = 20; }
      else if (border === 3) { r *= 0.55; g *= 0.55; b *= 0.5; }
      const o = i * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    w.hlCache = {};
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
    // coast shadow
    ctx.save();
    ctx.shadowColor = 'rgba(30,60,80,0.55)'; ctx.shadowBlur = 10 * cam.z; ctx.fillStyle = '#d9cfb0';
    for (const n in NAP.LAND) { polyPath(ctx, NAP.LAND[n], 1); ctx.fill(); }
    ctx.restore();
    // province colours clipped to land
    ctx.save();
    ctx.beginPath();
    for (const n in NAP.LAND) {
      const f = NAP.LAND[n];
      for (let i = 0; i < f.length; i += 2) { const [x, y] = NAP.proj(f[i], f[i + 1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
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
    ctx.restore();
    // coast line
    ctx.strokeStyle = 'rgba(40,35,25,0.8)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
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
    ctx.font = 'italic 12px Georgia, serif'; ctx.fillStyle = 'rgba(30,60,90,0.55)'; ctx.textAlign = 'center';
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
        ctx.font = `${fs}px Georgia, serif`;
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
    ctx.restore();
  };
})();
