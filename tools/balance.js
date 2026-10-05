#!/usr/bin/env node
/* Napworld balance harness (headless Chromium via Playwright).
 *   node tools/balance.js battles [n]            battle matchups, split by attacker/defender
 *   node tools/balance.js campaign [runs] [diff] bot-played campaigns, per-nation territory stats
 *   node tools/balance.js all
 * Needs `playwright` (local or global) and a Chromium (PLAYWRIGHT_BROWSERS_PATH or CHROMIUM_PATH). */
const path = require('path');
const { execSync } = require('child_process');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const exe = process.env.CHROMIUM_PATH || (require('fs').existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const [mode = 'all', a1, a2] = process.argv.slice(2);

const MATCHUPS = [
  { name: 'mirror lines', a: 'line:8 art:2', b: 'line:8 art:2' },
  { name: 'mirror full', a: 'line:8 light:2 hussar:2 cuirass:1 art:3', b: 'line:8 light:2 hussar:2 cuirass:1 art:3' },
  { name: 'guard vs line', a: 'guard:3 line:5 art:2', b: 'line:8 art:2' },
  { name: 'cav vs squares', a: 'line:5 cuirass:3 hussar:2', b: 'line:8 art:2' },
  { name: 'guns vs none', a: 'line:6 art:4', b: 'line:8' }
];

async function open() {
  const b = await pw.chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
  p.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await p.goto(URL); await p.waitForFunction('window.NAP_UI_READY');
  return [b, p];
}

async function battles(n) {
  const [b, p] = await open();
  const res = await p.evaluate(async ({ cfg, n }) => {
    const out = [];
    for (const c of cfg) {
      const r = { name: c.name, side0: 0, side1: 0, atkWins: 0, defWins: 0, t: 0, cas0: 0, cas1: 0, n };
      for (let i = 0; i < n; i++) {
        const mk = (f, spec) => { const units = []; spec.split(' ').forEach((t) => { const [k, m] = t.split(':'); for (let j = 0; j < +m; j++) { const u = { type: k, men: NAP.UNITS[k].men, max: NAP.UNITS[k].men }; units.push({ ref: u, type: k, men: u.men, max: u.max, faction: f }); } }); return { faction: f, units, general: { id: 1, name: 'G', atk: 3, def: 3, lead: 3 } }; };
        const spec = { terrain: 'p', provName: 'T' + i, weather: ['clear', 'rain', 'fog', 'snow'][i % 4], tod: ['day', 'dusk', 'dawn'][i % 3], playerIsAttacker: i % 2 === 0, fort: 0, fortSide: -1, aiBothSides: true, sides: [mk('france', c.a), mk('russia', c.b)] };
        document.getElementById('game').hidden = true; document.getElementById('battle').hidden = false;
        NAP.runBattle(spec, document.getElementById('battle'));
        const B = NAP.currentBattle; B.paused = false; B.aiBothSides = true;
        let k = 0; while (!B.over && k++ < 13000) B.step(0.05);
        if (B.winner === 0) r.side0++; else r.side1++;
        if ((B.winner === 0) === spec.playerIsAttacker) r.atkWins++; else r.defWins++;
        r.t += B.t; r.cas0 += B.result.casualties[0]; r.cas1 += B.result.casualties[1];
        B.close();
      }
      out.push(r);
    }
    return out;
  }, { cfg: MATCHUPS, n });
  console.log('\nBATTLES (side A = first listed, attacker alternates)');
  for (const r of res) console.log(r.name.padEnd(16), `A ${r.side0} - B ${r.side1}`, ` attacker wins ${r.atkWins}/${r.n}`, ` avg ${Math.round(r.t)/r.n|0}s`, ` losses A ${Math.round(r.cas0 / r.n)} B ${Math.round(r.cas1 / r.n)}`);
  await b.close();
}

async function campaign(runs, diff) {
  const [b, p] = await open();
  const res = await p.evaluate(async ({ runs, diff }) => {
    const C = NAP.C, majors = ['france', 'britain', 'austria', 'prussia', 'russia', 'ottoman', 'spain', 'portugal', 'sweden', 'denmark', 'naples', 'bavaria'];
    const agg = {}; majors.forEach((f) => (agg[f] = { sum8: 0, sum15: 0, alive15: 0, max: 0, n: 0 }));
    const tops = [];
    for (let r = 0; r < runs; r++) {
      C.newGame(majors[r % majors.length], diff);
      C.hooks.askBattle = async () => 'auto'; C.hooks.runBattle = null; C.hooks.event = async () => 0; C.hooks.offer = async () => true; C.hooks.refresh = () => {}; C.hooks.notify = () => {};
      const s = C.get(); s.autoplay = true; s.noVictory = true;
      for (let i = 0; i < 132; i++) {
        await C.endTurn();
        if (i === 35) majors.forEach((f) => { agg[f].sum8 += C.provincesOf(f).length; });
      }
      majors.forEach((f) => { const n = C.provincesOf(f).length; agg[f].sum15 += n; if (n) agg[f].alive15++; agg[f].max = Math.max(agg[f].max, n); });
      tops.push(majors.map((f) => [f, C.provincesOf(f).length]).sort((a, b) => b[1] - a[1])[0].join(':'));
    }
    return { agg, tops };
  }, { runs, diff });
  console.log(`\nCAMPAIGN (${runs} bot games, ${diff}); biggest power at end: ${res.tops.join(' ')}`);
  for (const f of Object.keys(res.agg)) { const a = res.agg[f]; console.log(f.padEnd(9), 'avg 1808', (a.sum8 / runs).toFixed(1).padStart(5), ' avg 1815', (a.sum15 / runs).toFixed(1).padStart(5), ' survive', `${a.alive15}/${runs}`, ' max', a.max); }
  await b.close();
}

(async () => {
  if (mode === 'battles' || mode === 'all') await battles(+a1 || 12);
  if (mode === 'campaign' || mode === 'all') await campaign(+(mode === 'all' ? 0 : a1) || 12, (mode === 'all' ? '' : a2) || 'normal');
})();
