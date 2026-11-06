// 木製 5 速手排變速箱: a countershaft box with synchro-less dog collars, built from wood.
// One source of truth: the tooth counts below. Module 4 mm, every mesh has tooth sum 60, so the centre distance is
// 4 * 60 / 2 = 120 mm. Every angle, ratio, gauge and chart reads from GEARS / ZI / ZC0; nothing is keyframed by hand.
import * as THREE from 'three';

// ------------------------------------------------------------------ the machine's numbers
const M = 4; // module, mm
const FW = 16; // gear face width, mm
const CS_Y = -120; // countershaft height under the main axis = centre distance
const ZI = 24; // input gear on the input shaft
const ZC0 = 36; // its mate on the countershaft
const STAGE1 = ZC0 / ZI; // 1.5
// z: axial position (mm); zc: countershaft gear teeth; zm: mainshaft gear teeth; side: where its dog collar sits
const GEARS = [
  {n: 1, zc: 18, zm: 42, z: 80, side: 1, collar: 0, dir: -1},
  {n: 2, zc: 24, zm: 36, z: 160, side: -1, collar: 0, dir: 1},
  {n: 3, zc: 30, zm: 30, z: 230, side: 1, collar: 1, dir: -1},
  {n: 4, zc: 36, zm: 24, z: 310, side: -1, collar: 1, dir: 1},
  {n: 5, zc: 42, zm: 18, z: 405, side: -1, collar: 2, dir: 1},
];
const COLLARS = [{z: 120}, {z: 270}, {z: 365}];
const TRAVEL = 16; // collar slide to lock a gear, mm
const FINAL = 4.1; // final drive
const TIRE = 1.9; // tyre circumference, m
const SLOW = 1 / 30; // slow motion: 3000 rpm would be a blur
const ratioOf = (g) => STAGE1 * (g.zm / g.zc);
const speedKmh = (outRpm) => (outRpm / FINAL) * TIRE * 0.06;
const torque = (rpm) => 150 * (1 - 0.45 * Math.pow((rpm - 3800) / 4200, 2)); // N·m, a plain petrol curve
const GEAR_BY = {1: [0, -1], 2: [0, 1], 3: [1, -1], 4: [1, 1], 5: [2, 1]};
// a meshing pair: A's tooth points at B on the line of centres (angle phi) when B shows a gap there
const meshAngle = (thA, zA, zB, phi) => phi + Math.PI - Math.PI / zB - (zA / zB) * (thA - phi);

// ------------------------------------------------------------------ wood
const KINDS = {
  maple: ['#e6c590', '#a47a45', 11],
  oak: ['#cfa066', '#8a5f2e', 23],
  walnut: ['#82583a', '#4a2c18', 37],
  cherry: ['#c0724a', '#7d3f22', 51],
  beech: ['#d9b27c', '#9a6c3c', 63],
  ply: ['#e8d3a8', '#b99560', 71],
};
const texCache = {};
function woodTex(kind) {
  if (texCache[kind]) return texCache[kind];
  const [base, dark, seed] = KINDS[kind];
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 80; i++) {
    const y = r() * 512;
    g.strokeStyle = dark;
    g.globalAlpha = 0.06 + r() * 0.18;
    g.lineWidth = 0.6 + r() * 2.4;
    g.beginPath();
    const a = 2 + r() * 7;
    const f = 0.004 + r() * 0.01;
    const ph = r() * 6;
    for (let x = 0; x <= 512; x += 8) {
      const yy = y + Math.sin(x * f * 6 + ph) * a;
      if (x) g.lineTo(x, yy);
      else g.moveTo(x, yy);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(1 / 160, 1 / 160);
  t.anisotropy = 4;
  return (texCache[kind] = t);
}
const wood = (kind, extra = {}) => new THREE.MeshStandardMaterial({map: woodTex(kind), roughness: 0.62, metalness: 0, ...extra});

// ------------------------------------------------------------------ geometry
const gearCache = {};
function gearGeo(z) {
  if (gearCache[z]) return gearCache[z];
  const rp = (M * z) / 2;
  const ra = rp + M * 0.9;
  const rf = rp - M * 1.2;
  const p = (2 * Math.PI) / z;
  const s = new THREE.Shape();
  let first = true;
  for (let i = 0; i < z; i++) {
    for (const [r, k] of [[rf, -0.34], [ra, -0.15], [ra, 0.15], [rf, 0.34]]) {
      const a = i * p + k * p;
      if (first) {
        s.moveTo(r * Math.cos(a), r * Math.sin(a));
        first = false;
      } else s.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
  }
  s.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, 10, 0, Math.PI * 2, true);
  s.holes.push(bore);
  if (z >= 30) {
    // laser-cut lightening holes
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * rp * 0.55, Math.sin(a) * rp * 0.55, rp * 0.15, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
  }
  const geo = new THREE.ExtrudeGeometry(s, {depth: FW, bevelEnabled: false, curveSegments: 10});
  geo.translate(0, 0, -FW / 2);
  return (gearCache[z] = geo);
}
const zCyl = (r, len, seg = 32) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);
const lathe = (prof, seg) => new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), seg).rotateX(Math.PI / 2);
const shadowed = (m) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

// ------------------------------------------------------------------ scene
const BG = '#f2e6d2';
const app = document.getElementById('app');
const canvas = document.createElement('canvas');
canvas.id = 'gl';
app.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance'});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(BG, 1500, 3200);
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 5, 6000);

scene.add(new THREE.HemisphereLight('#fffaf2', '#d9c6a6', 1.15));
const sun = new THREE.DirectionalLight('#fff4e4', 2.6);
sun.position.set(-320, 760, 560);
sun.target.position.set(0, -60, 215);
sun.castShadow = true;
Object.assign(sun.shadow.camera, {left: -480, right: 480, top: 480, bottom: -480, near: 100, far: 1800});
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
sun.shadow.radius = 4;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#ffe9d0', 0.7);
fill.position.set(420, 200, -300);
scene.add(fill);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({color: '#efe0c6', roughness: 1}));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -232;
ground.receiveShadow = true;
scene.add(ground);

const hlMats = {in: [], c0: [], c: [], g: [], collar: [], out: []};
const mk = (kind, bucket, extra) => {
  const m = wood(kind, extra);
  if (bucket) bucket.push(m);
  return m;
};

// --- input side: shaft + 24T gear, turning together
const inGroup = new THREE.Group();
scene.add(inGroup);
{
  const shaftMat = mk('beech', hlMats.in);
  inGroup.add(shadowed(new THREE.Mesh(zCyl(8, 170), shaftMat)).translateZ(-45));
  const stripe = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 170), mk('cherry')));
  stripe.position.set(8, 0, -45);
  inGroup.add(stripe);
  const gm = shadowed(new THREE.Mesh(gearGeo(ZI), mk('maple', hlMats.in)));
  gm.position.z = 0;
  inGroup.add(gm);
}

// --- countershaft: 36T + five gears, one rigid wooden shaft
const csGroup = new THREE.Group();
csGroup.position.y = CS_Y;
scene.add(csGroup);
{
  const shaftMat = mk('beech');
  csGroup.add(shadowed(new THREE.Mesh(zCyl(8, 520), shaftMat)).translateZ(180));
  const stripe = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 520), mk('cherry')));
  stripe.position.set(8, 0, 180);
  csGroup.add(stripe);
  const c0 = shadowed(new THREE.Mesh(gearGeo(ZC0), mk('walnut', hlMats.c0)));
  csGroup.add(c0);
  for (const g of GEARS) {
    const gm = shadowed(new THREE.Mesh(gearGeo(g.zc), mk('walnut', hlMats.c)));
    gm.position.z = g.z;
    gm.userData.n = g.n;
    csGroup.add(gm);
  }
}
// the matching material list per gear number for highlighting
const cMat = (n) => hlMats.c[n - 1];
const gMat = (n) => hlMats.g[n - 1];

// --- mainshaft with free-spinning gears and sliding dog collars
const mainShaft = new THREE.Group();
scene.add(mainShaft);
{
  const shaftMat = mk('beech', hlMats.out);
  mainShaft.add(shadowed(new THREE.Mesh(zCyl(8, 446), shaftMat)).translateZ(267));
  const stripe = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3, 3, 446), mk('cherry')));
  stripe.position.set(8, 0, 267);
  mainShaft.add(stripe);
}
const freeGears = [];
const KIND_MAIN = ['maple', 'oak', 'cherry', 'oak', 'maple'];
for (const g of GEARS) {
  const grp = new THREE.Group();
  grp.position.z = g.z;
  const gm = shadowed(new THREE.Mesh(gearGeo(g.zm), mk(KIND_MAIN[g.n - 1], hlMats.g)));
  grp.add(gm);
  // dog ring on the collar's side: faceted so the teeth read
  const dog = shadowed(new THREE.Mesh(lathe([[10, -6], [21, -6], [21, 6], [10, 6]], 10), mk('walnut')));
  dog.position.z = g.side * (FW / 2 + 6);
  grp.add(dog);
  scene.add(grp);
  freeGears.push(grp);
}
const collarGroups = [];
const forks = [];
for (const [i, c] of COLLARS.entries()) {
  const grp = new THREE.Group();
  const mat = mk('cherry', hlMats.collar);
  grp.add(shadowed(new THREE.Mesh(lathe([[24, -9], [28, -9], [28, 9], [24, 9]], 10), mat)));
  grp.add(shadowed(new THREE.Mesh(zCyl(26, 4, 10), mat)));
  grp.position.z = c.z;
  mainShaft.add(grp);
  collarGroups.push(grp);
  // the fork: a half ring over the collar, an arm and a short selector rod
  const fork = new THREE.Group();
  const fm = mk('walnut');
  fork.add(shadowed(new THREE.Mesh(new THREE.TorusGeometry(31, 2.6, 8, 28, Math.PI), fm)));
  const arm = shadowed(new THREE.Mesh(new THREE.BoxGeometry(6, 70, 6), fm));
  arm.position.y = 65;
  fork.add(arm);
  const rod = shadowed(new THREE.Mesh(zCyl(3, 64, 12), fm));
  rod.position.y = 100;
  fork.add(rod);
  fork.position.z = c.z;
  scene.add(fork);
  forks.push(fork);
}

// --- housing: base, end walls and case panels (the panels fade for the cutaway)
const ply = wood('ply', {roughness: 0.8});
const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(380, 16, 560), ply));
base.position.set(0, -224, 180);
scene.add(base);
const caseMat = new THREE.MeshStandardMaterial({color: '#f4e6c8', roughness: 0.7, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide});
const casePanels = new THREE.Group();
const panel = (w, h, d, x, y, z) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), caseMat);
  m.position.set(x, y, z);
  m.renderOrder = 5;
  casePanels.add(m);
};
panel(380, 346, 16, 0, -43, -90);
panel(380, 346, 16, 0, -43, 450);
panel(16, 346, 540, -190, -43, 180);
panel(16, 346, 540, 190, -43, 180);
panel(380, 16, 540, 0, 130, 180);
scene.add(casePanels);
const flangeMat = wood('walnut');
for (const [y, z] of [[0, -90], [CS_Y, -90], [CS_Y, 450], [0, 450]]) {
  const f = shadowed(new THREE.Mesh(zCyl(19, 24), flangeMat));
  f.position.set(0, y, z);
  scene.add(f);
}

// ------------------------------------------------------------------ labels
const LABELS = [
  {t: '輸入軸 · 接引擎', p: [0, 24, -128]},
  {t: `輸入齒輪 ${ZI}T`, p: [0, 56, 0]},
  {t: `中間軸 ${ZC0}T`, p: [0, CS_Y - 82, 0]},
  {t: '輸出軸 · 接傳動軸', p: [0, 24, 488]},
  ...GEARS.map((g) => ({t: `${g.n}檔 ${g.zm}T/${g.zc}T`, p: [0, (M * g.zm) / 2 + 14, g.z]})),
  {t: '撥叉 + 滑動套筒', p: [0, 112, 120]},
];
const lblLayer = document.createElement('div');
lblLayer.className = 'lbls';
app.appendChild(lblLayer);
const lblEls = LABELS.map((l) => {
  const d = document.createElement('div');
  d.textContent = l.t;
  lblLayer.appendChild(d);
  return d;
});

// ------------------------------------------------------------------ UI
const ui = document.createElement('div');
ui.className = 'ui';
ui.innerHTML = `
<div class="hdr"><b>木製 5 速手排變速箱</b><span>模數 ${M} mm · 中心距 ${(M * 60) / 2} mm · 慢動作 1/${1 / SLOW}×</span></div>
<div class="chip" id="chip"></div>
<div class="panel gauges">
  <div class="gear" id="gGear">N</div>
  <div class="g"><label>引擎轉速</label><b id="gIn">0</b><u>rpm</u></div>
  <div class="g"><label>輸出轉速</label><b id="gOut">0</b><u>rpm</u></div>
  <div class="g"><label>傳動比</label><b id="gRatio">—</b><u>: 1</u></div>
  <div class="g"><label>輸出扭力</label><b id="gTq">0</b><u>N·m</u></div>
  <div class="g"><label>車速</label><b id="gKmh">0</b><u>km/h</u></div>
  <canvas id="chart" width="320" height="170"></canvas>
  <div class="note">各檔車速 vs 引擎轉速;點為目前狀態</div>
</div>
<div class="cap" id="cap"></div>
<div class="bar">
  <div class="grp" id="gears"></div>
  <div class="grp sl"><label>引擎轉速</label><input id="rpm" type="range" min="700" max="6000" step="10" value="1200"><b id="rpmV">1200</b></div>
  <div class="grp" id="views"></div>
  <div class="grp" id="tog"></div>
</div>`;
app.appendChild(ui);
const $ = (id) => document.getElementById(id);
const btn = {};
const addBtn = (parent, key, text, title) => {
  const b = document.createElement('button');
  b.textContent = text;
  b.title = title || '';
  b.dataset.k = key;
  $(parent).appendChild(b);
  btn[key] = b;
  return b;
};
addBtn('gears', 'g0', 'N', '空檔 (0)');
for (const g of GEARS) addBtn('gears', `g${g.n}`, `${g.n}`, `${g.n} 檔 (${g.n})`);
const VIEWS = {
  hero: {az: 38, el: 24, d: 960, t: [0, -60, 215], label: '全景', key: 'q'},
  side: {az: 90, el: 4, d: 1000, t: [0, -50, 215], label: '側視', key: 'w'},
  top: {az: 0, el: 84, d: 940, t: [0, -60, 215], label: '俯視', key: 'e'},
  end: {az: -28, el: 10, d: 760, t: [0, -50, 110], label: '端視', key: 'r'},
};
for (const [k, v] of Object.entries(VIEWS)) addBtn('views', k, v.label, `${v.label} (${v.key})`);
addBtn('tog', 'case', '外殼', '外殼 / 剖開 (c)');
addBtn('tog', 'labels', '標註', '標註 (l)');
addBtn('tog', 'path', '動力路徑', '亮出動力路徑 (p)');

// ------------------------------------------------------------------ state
const S = {
  cur: 0, // gear whose collar is (or is going to be) locked
  tgt: 0, // gear the visitor asked for
  phase: 'idle', // idle | out | in
  pos: [0, 0, 0], // collar slide, -1..1
  rpm: 1200,
  rpmTgt: 1200,
  rpmS: 0, // mainshaft rpm
  thI: 0,
  thS: 0,
  case: 1,
  labels: 1,
  path: 1,
  hl: 0,
  view: 'hero',
  T: 0,
};
const off = {az: 0, el: 0, k: 1};
const cam = {az: 38, el: 24, d: 960, tx: 0, ty: -60, tz: 215};
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const ease = (dt, tau) => 1 - Math.exp(-dt / tau);

function setGear(n) {
  S.tgt = n;
}
function stepShift(dt) {
  const k = ease(dt, 0.07);
  const want = [0, 0, 0];
  if (S.phase === 'idle' && S.tgt !== S.cur) S.phase = 'out';
  if (S.phase === 'out') {
    if (S.pos.every((p) => Math.abs(p) < 0.04)) {
      S.cur = S.tgt;
      S.phase = S.cur ? 'in' : 'idle';
    }
  }
  if (S.cur && S.phase !== 'out') {
    const [ci, side] = GEAR_BY[S.cur];
    want[ci] = side;
  }
  for (let i = 0; i < 3; i++) S.pos[i] += (want[i] - S.pos[i]) * k;
  if (S.phase === 'in') {
    const [ci, side] = GEAR_BY[S.cur];
    if (Math.abs(S.pos[ci] - side) < 0.04) S.phase = 'idle';
  }
  if (S.phase === 'idle' && S.tgt !== S.cur) S.phase = 'out';
}
const engaged = () => S.cur > 0 && S.phase === 'idle';

// ------------------------------------------------------------------ input
let tour = true;
let tourT0 = 0;
let lastInput = 0;
const takeOver = () => {
  lastInput = S.T;
  tour = false;
};
const TOUR = [
  {t: 0, g: 0, rpm: 900, v: 'hero'},
  {t: 4, g: 1, rpm: 1500, v: 'side'},
  {t: 10, g: 2, rpm: 2100, v: 'hero'},
  {t: 15, g: 3, rpm: 2600, v: 'end'},
  {t: 20, g: 4, rpm: 3000, v: 'side'},
  {t: 25, g: 5, rpm: 3400, v: 'top'},
  {t: 31, g: 5, rpm: 3400, v: 'hero', case: 0},
  {t: 36, g: 0, rpm: 900, v: 'hero', case: 1},
];
const TOUR_LEN = 40;
let tourIdx = -1;
const pulse = (b) => {
  b.classList.add('pulse');
  setTimeout(() => b.classList.remove('pulse'), 600);
};
const setView = (v) => {
  S.view = v;
  Object.assign(off, {az: 0, el: 0, k: 1});
};
for (const b of Object.values(btn)) {
  b.addEventListener('click', () => {
    takeOver();
    const k = b.dataset.k;
    if (k[0] === 'g') setGear(Number(k.slice(1)));
    else if (VIEWS[k]) setView(k);
    else if (k === 'case') S.case = 1 - S.case;
    else if (k === 'labels') S.labels = 1 - S.labels;
    else if (k === 'path') S.path = 1 - S.path;
  });
}
$('rpm').addEventListener('input', (e) => {
  takeOver();
  S.rpmTgt = Number(e.target.value);
});
$('chip').addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (tour) takeOver();
  else {
    tour = true;
    tourT0 = S.T;
    tourIdx = -1;
  }
});
addEventListener('pointerdown', (e) => {
  if (e.target.id !== 'chip') takeOver();
});
addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.key.toLowerCase();
  if (/^[0-5]$/.test(k)) btn[`g${k}`].click();
  else if (k === 'q') btn.hero.click();
  else if (k === 'w') btn.side.click();
  else if (k === 'e') btn.top.click();
  else if (k === 'r') btn.end.click();
  else if (k === 'c') btn.case.click();
  else if (k === 'l') btn.labels.click();
  else if (k === 'p') btn.path.click();
  else if (k === 't') $('chip').dispatchEvent(new Event('pointerdown'));
  else return;
  e.preventDefault();
});
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = {x: e.clientX, y: e.clientY};
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('drag');
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  off.az -= (e.clientX - drag.x) * 0.3;
  off.el = clamp(off.el + (e.clientY - drag.y) * 0.2, -30, 60);
  drag = {x: e.clientX, y: e.clientY};
  lastInput = S.T;
});
const endDrag = () => {
  drag = null;
  canvas.classList.remove('drag');
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    takeOver();
    off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.2);
  },
  {passive: false},
);

function runTour() {
  const c = (S.T - tourT0) % TOUR_LEN;
  let i = 0;
  for (let j = 0; j < TOUR.length; j++) if (c >= TOUR[j].t) i = j;
  const key = Math.floor((S.T - tourT0) / TOUR_LEN) * 100 + i;
  if (key === tourIdx) return;
  tourIdx = key;
  const s = TOUR[i];
  setGear(s.g);
  S.rpmTgt = s.rpm;
  $('rpm').value = s.rpm;
  if (s.v !== S.view) setView(s.v);
  if (s.case !== undefined) S.case = s.case;
  pulse(btn[`g${s.g}`]);
}

// ------------------------------------------------------------------ resize
const resize = () => {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 1.3 ? 44 : 30;
  camera.updateProjectionMatrix();
};
addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ chart
const chart = $('chart');
const cg = chart.getContext('2d');
const RMAX = 6500;
const VMAX = 280;
function drawChart() {
  const W = chart.width;
  const H = chart.height;
  const x0 = 34;
  const y0 = H - 22;
  const X = (r) => x0 + (r / RMAX) * (W - x0 - 8);
  const Y = (v) => y0 - (v / VMAX) * (y0 - 8);
  cg.clearRect(0, 0, W, H);
  cg.font = '10px JetBrains Mono, monospace';
  cg.lineWidth = 1;
  cg.strokeStyle = '#eadfcd';
  cg.fillStyle = '#9b8f80';
  for (const v of [0, 100, 200]) {
    cg.beginPath();
    cg.moveTo(x0, Y(v));
    cg.lineTo(W - 8, Y(v));
    cg.stroke();
    cg.fillText(String(v), 4, Y(v) + 3);
  }
  for (const r of [0, 2000, 4000, 6000]) cg.fillText(String(r / 1000) + 'k', X(r) - 6, H - 8);
  for (const g of GEARS) {
    const on = S.cur === g.n;
    cg.strokeStyle = on ? '#e3562a' : '#c9b79b';
    cg.lineWidth = on ? 2.4 : 1.2;
    cg.beginPath();
    cg.moveTo(X(0), Y(0));
    cg.lineTo(X(6000), Y(speedKmh(6000 / ratioOf(g))));
    cg.stroke();
    cg.fillStyle = on ? '#e3562a' : '#9b8f80';
    cg.fillText(String(g.n), X(6000) + 1, Y(speedKmh(6000 / ratioOf(g))) + 3);
  }
  const v = speedKmh(S.rpmS);
  cg.fillStyle = '#2a2521';
  cg.beginPath();
  cg.arc(X(S.rpm), Y(v), 4, 0, Math.PI * 2);
  cg.fill();
}

// ------------------------------------------------------------------ the frame
const HL = new THREE.Color('#ff6a28');
const setHl = (mats, v) => {
  for (const m of Array.isArray(mats) ? mats : [mats]) {
    m.emissive.copy(HL);
    m.emissiveIntensity = 0.55 * v;
  }
};
const pv = new THREE.Vector3();
let last = performance.now();
let frameN = 0;
function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  S.T += dt;
  frameN++;
  if (tour) runTour();
  else if (S.T - lastInput > 25) {
    tour = true;
    tourT0 = S.T;
    tourIdx = -1;
  }

  // the machine
  stepShift(dt);
  S.rpm += (S.rpmTgt - S.rpm) * ease(dt, 0.35);
  const g = S.cur ? GEARS[S.cur - 1] : null;
  const live = engaged();
  const rpmS = live ? S.rpm / ratioOf(g) : 0;
  S.rpmS += (rpmS - S.rpmS) * ease(dt, live ? 0.22 : 0.5);
  S.thI += S.rpm * ((2 * Math.PI) / 60) * SLOW * dt;
  S.thS += S.rpmS * ((2 * Math.PI) / 60) * SLOW * dt;
  const thC = meshAngle(S.thI, ZI, ZC0, -Math.PI / 2);
  inGroup.rotation.z = S.thI;
  csGroup.rotation.z = thC;
  mainShaft.rotation.z = S.thS;
  for (const gg of GEARS) freeGears[gg.n - 1].rotation.z = meshAngle(thC, gg.zc, gg.zm, Math.PI / 2);
  for (let i = 0; i < 3; i++) {
    collarGroups[i].position.z = COLLARS[i].z + S.pos[i] * TRAVEL;
    forks[i].position.z = COLLARS[i].z + S.pos[i] * TRAVEL;
  }

  // the part doing the work lights up
  S.hl += ((live && S.path ? 1 : 0) - S.hl) * ease(dt, 0.18);
  const sel = S.cur;
  for (const m of [...hlMats.in, ...hlMats.c0, ...hlMats.out, ...hlMats.collar]) setHl(m, 0);
  for (const m of hlMats.c) setHl(m, 0);
  for (const m of hlMats.g) setHl(m, 0);
  if (sel) {
    setHl(hlMats.in, S.hl);
    setHl(hlMats.c0, S.hl);
    setHl(cMat(sel), S.hl);
    setHl(gMat(sel), S.hl);
    setHl(hlMats.out, S.hl * 0.6);
    setHl(hlMats.collar[GEAR_BY[sel][0]], S.hl);
  }
  caseMat.opacity += ((S.case ? 0.2 : 0) - caseMat.opacity) * ease(dt, 0.25);
  casePanels.visible = caseMat.opacity > 0.004;
  lblLayer.style.opacity = S.labels ? 1 : 0;

  // camera
  const v = VIEWS[S.view];
  const k = 1 - Math.exp(-dt / (tour ? 0.3 : 0.45));
  cam.az += wrap(v.az + off.az - cam.az) * k;
  cam.el += (clamp(v.el + off.el, -20, 88) - cam.el) * k;
  cam.d += (v.d * off.k - cam.d) * k;
  cam.tx += (v.t[0] - cam.tx) * k;
  cam.ty += (v.t[1] - cam.ty) * k;
  cam.tz += (v.t[2] - cam.tz) * k;
  const az = cam.az * D2R;
  const el = cam.el * D2R;
  camera.position.set(cam.tx + cam.d * Math.cos(el) * Math.sin(az), cam.ty + cam.d * Math.sin(el), cam.tz + cam.d * Math.cos(el) * Math.cos(az));
  camera.lookAt(cam.tx, cam.ty, cam.tz);
  renderer.render(scene, camera);

  // labels
  if (S.labels) {
    camera.updateMatrixWorld();
    for (const [i, l] of LABELS.entries()) {
      pv.set(...l.p).project(camera);
      const el2 = lblEls[i];
      el2.style.transform = `translate(${(pv.x * 0.5 + 0.5) * innerWidth}px, ${(-pv.y * 0.5 + 0.5) * innerHeight}px)`;
      el2.classList.toggle('on', !!sel && (l.t.startsWith(`${sel}檔`) || (sel && (l.t.startsWith('輸入齒輪') || l.t.startsWith('中間軸')))));
    }
  }

  // panels, from the same state
  const ratio = g ? ratioOf(g) : 0;
  $('gGear').textContent = S.phase === 'idle' || S.tgt === S.cur ? (g ? String(g.n) : 'N') : '···';
  $('gIn').textContent = Math.round(S.rpm);
  $('gOut').textContent = Math.round(S.rpmS);
  $('gRatio').textContent = g ? ratio.toFixed(3) : '—';
  $('gTq').textContent = live ? Math.round(torque(S.rpm) * ratio) : 0;
  $('gKmh').textContent = Math.round(speedKmh(S.rpmS));
  $('rpmV').textContent = Math.round(S.rpmTgt);
  for (const b of Object.values(btn)) {
    const kk = b.dataset.k;
    const on = kk[0] === 'g' ? Number(kk.slice(1)) === S.tgt : kk === S.view || (kk === 'case' && S.case) || (kk === 'labels' && S.labels) || (kk === 'path' && S.path);
    b.classList.toggle('on', !!on);
  }
  if (frameN % 2 === 0) drawChart();
  const cap = g
    ? `${g.n} 檔 · 第一級 ${ZI}T→${ZC0}T (×${STAGE1}) · 第二級 ${g.zc}T→${g.zm}T (×${(g.zm / g.zc).toFixed(3)}) = ${ratio.toFixed(3)} : 1 · 套筒鎖住 ${g.n} 檔齒輪,動力走亮色路徑`
    : `N 空檔 · 輸入軸與中間軸空轉,所有主軸齒輪空轉,套筒都在中位,輸出軸不動`;
  $('cap').textContent = S.phase === 'idle' || S.tgt === S.cur ? cap : '換檔中 · 套筒先退回中位,再滑向新檔位,動力暫時中斷';
  const chip = $('chip');
  if (chip.classList.contains('on') !== tour || !chip.firstChild) {
    chip.classList.toggle('on', tour);
    chip.innerHTML = tour ? '<i></i>自動導覽 · 點擊接手' : '▶ 繼續導覽';
  }
  requestAnimationFrame(frame);
}
tourT0 = 0;
requestAnimationFrame(frame);
window.LIVE = {S, cam, setGear, setView};
