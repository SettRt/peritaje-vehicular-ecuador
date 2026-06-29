const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const demoVehicles = [
  {
    plate: 'ABC1234',
    brand: 'Toyota',
    model: 'Hilux',
    year: '2022',
    type: 'Pickup',
    class: 'Camioneta',
    service: 'Particular',
    country: 'Tailandia',
    displacement: '2400 cc',
    primaryColor: 'Blanco',
    secondaryColor: 'No aplica',
    state: 'Activo',
    registrationDate: '2025-02-10',
    expirationDate: '2026-02-10',
    canton: 'Quito',
    ramvCpn: 'CPN-000000',
    fines: 0,
    restriction: '',
  },
  {
    plate: 'PBC9182',
    brand: 'Kia',
    model: 'Sportage',
    year: '2021',
    type: 'SUV',
    class: 'Jeep',
    service: 'Particular',
    country: 'Corea del Sur',
    displacement: '2000 cc',
    primaryColor: 'Gris',
    secondaryColor: 'No aplica',
    state: 'Activo',
    registrationDate: '2024-11-18',
    expirationDate: '2025-11-18',
    canton: 'Guayaquil',
    ramvCpn: 'CPN-451902',
    fines: 0,
    restriction: '',
  },
  {
    plate: 'GSD0447',
    brand: 'Chevrolet',
    model: 'Spark',
    year: '2018',
    type: 'Hatchback',
    class: 'Automovil',
    service: 'Particular',
    country: 'Colombia',
    displacement: '1200 cc',
    primaryColor: 'Rojo',
    secondaryColor: 'No aplica',
    state: 'Observado',
    registrationDate: '2023-08-02',
    expirationDate: '2024-08-02',
    canton: 'Cuenca',
    ramvCpn: 'RAMV-827133',
    fines: 3,
    restriction: 'Revision por matricula caducada',
  },
  {
    plate: 'TMA7290',
    brand: 'Nissan',
    model: 'Frontier',
    year: '2020',
    type: 'Pickup',
    class: 'Camioneta doble cabina',
    service: 'Comercial',
    country: 'Mexico',
    displacement: '2500 cc',
    primaryColor: 'Azul',
    secondaryColor: 'No aplica',
    state: 'Bloqueado',
    registrationDate: '2022-03-14',
    expirationDate: '2023-03-14',
    canton: 'Manta',
    ramvCpn: 'CPN-994110',
    fines: 5,
    restriction: 'Prohibicion de enajenar',
  },
];

const photoLabels = ['Frente', 'Parte trasera', 'Lado izquierdo', 'Lado derecho', 'Motor', 'Chasis', 'VIN', 'Danos'];

let records = JSON.parse(localStorage.getItem('peritaje.records') || '[]');
let currentVehicle = null;
let currentLegal = null;
let currentReport = null;
let currentCategory = 'pickup';
let lightMode = 1;
let simpleRotation = 0;

let threeReady = false;
let THREE = null;
let OrbitControls = null;
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let vehicleGroup = null;
let keyLight = null;

function normalizePlate(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
}

function inferCategory(vehicle) {
  const source = `${vehicle?.brand || ''} ${vehicle?.model || ''} ${vehicle?.type || ''} ${vehicle?.class || ''}`.toLowerCase();
  if (/hilux|frontier|ranger|l200|d-max|pickup|camioneta/.test(source)) return 'pickup';
  if (/sportage|suv|jeep|rav4|tucson|vitara/.test(source)) return 'suv';
  if (/spark|hatch|picanto|swift/.test(source)) return 'hatchback';
  if (/camion|bus|furgon/.test(source)) return 'truck';
  return 'sedan';
}

function categoryLabel(category) {
  return {
    pickup: 'Pickup',
    suv: 'SUV',
    hatchback: 'Hatchback',
    truck: 'Camion',
    sedan: 'Sedan',
  }[category] || 'Vehiculo';
}

function getVehicleForPlate(plate) {
  const normalized = normalizePlate(plate);
  const exact = demoVehicles.find((vehicle) => vehicle.plate === normalized);
  if (exact) return { ...exact };

  const seed = [...(normalized || 'ABC1234')].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const base = demoVehicles[seed % demoVehicles.length];
  return {
    ...base,
    plate: normalized || 'ABC1234',
    ramvCpn: `CPN-${String(seed * 97).slice(0, 6).padEnd(6, '0')}`,
  };
}

function buildLegalStatus(vehicle) {
  const expired = vehicle.expirationDate && new Date(vehicle.expirationDate) < new Date();
  const restricted = Boolean(vehicle.restriction);
  const pendingFines = Number(vehicle.fines || 0);
  const level = pendingFines > 0 || restricted ? 'critical' : expired || /observado/i.test(vehicle.state || '') ? 'warning' : 'clear';

  return {
    level,
    pendingFines,
    registrationValid: !expired,
    restrictions: restricted ? [vehicle.restriction] : [],
    payableItems: expired ? ['Matricula caducada o rubro pendiente'] : [],
    taxStatus: vehicle.state,
    summary:
      level === 'clear'
        ? 'Sin novedades relevantes'
        : level === 'warning'
          ? 'Tiene observaciones'
          : 'Tiene multas o restricciones',
  };
}

function setView(name) {
  $$('.view').forEach((view) => view.classList.toggle('active', view.id === name));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === name));
  $('#pageTitle').textContent =
    name === 'dashboard' ? 'Panel operativo' : name === 'consulta' ? 'Consulta vehicular' : name === 'historial' ? 'Historial' : 'Informe policial';
  resizeViewer();
}

function renderDetails(vehicle) {
  const rows = [
    ['Placa', vehicle.plate],
    ['Marca', vehicle.brand],
    ['Modelo', vehicle.model],
    ['Anio', vehicle.year],
    ['Tipo', vehicle.type],
    ['Clase', vehicle.class],
    ['Servicio', vehicle.service],
    ['Pais fabricacion', vehicle.country],
    ['Cilindraje', vehicle.displacement],
    ['Color principal', vehicle.primaryColor],
    ['Color secundario', vehicle.secondaryColor],
    ['Estado', vehicle.state],
    ['Matriculacion', vehicle.registrationDate],
    ['Caducidad', vehicle.expirationDate],
    ['Canton', vehicle.canton],
    ['RAMV / CPN', vehicle.ramvCpn],
  ];

  $('#vehicleDetails').innerHTML = rows
    .map(([label, value]) => `<div class="detail"><span>${label}</span><strong>${value || 'No disponible'}</strong></div>`)
    .join('');
}

function renderLegal(legal) {
  $('#legalStatus').className = 'legal-box';
  $('#legalStatus').innerHTML = `
    <span class="badge ${legal.level}">${legal.summary}</span>
    <div class="detail"><span>Multas pendientes</span><strong>${legal.pendingFines}</strong></div>
    <div class="detail"><span>Matricula</span><strong>${legal.registrationValid ? 'Vigente' : 'Vencida o por verificar'}</strong></div>
    <div class="detail"><span>Restricciones</span><strong>${legal.restrictions.join(', ') || 'Sin restricciones detectadas'}</strong></div>
    <div class="detail"><span>Rubros por pagar</span><strong>${legal.payableItems.join(', ') || 'Sin rubros detectados'}</strong></div>
  `;
}

function consultVehicle(plate) {
  currentVehicle = getVehicleForPlate(plate);
  currentLegal = buildLegalStatus(currentVehicle);
  currentCategory = inferCategory(currentVehicle);

  $('#plateInput').value = currentVehicle.plate;
  $('#quickPlate').value = currentVehicle.plate;
  $('#globalStatus').textContent = currentLegal.summary;
  $('#vehicleCategoryLabel').textContent = `${currentVehicle.brand} ${currentVehicle.model} - ${categoryLabel(currentCategory)}`;

  renderDetails(currentVehicle);
  renderLegal(currentLegal);
  renderVehicle(currentCategory);
  setView('consulta');
}

function renderPhotoInputs() {
  $('#photoGrid').innerHTML = photoLabels
    .map(
      (label) => `
        <label class="photo-tile">
          <strong>${label}</strong>
          <input type="file" accept="image/*" data-photo="${label}" />
        </label>
      `,
    )
    .join('');
}

function buildReport(record) {
  return `
    <p><strong>Fecha:</strong> ${new Date(record.createdAt).toLocaleDateString()}</p>
    <p><strong>Hora:</strong> ${new Date(record.createdAt).toLocaleTimeString()}</p>
    <p><strong>Agente:</strong> ${record.agent.name}</p>
    <p><strong>Unidad:</strong> ${record.agent.unit}</p>
    <hr />
    <p><strong>Placa:</strong> ${record.vehicle.plate}</p>
    <p><strong>Marca:</strong> ${record.vehicle.brand}</p>
    <p><strong>Modelo:</strong> ${record.vehicle.model}</p>
    <p><strong>Tipo:</strong> ${record.vehicle.type}</p>
    <p><strong>Color:</strong> ${record.vehicle.primaryColor}</p>
    <p><strong>Estado:</strong> ${record.vehicle.state}</p>
    <hr />
    <p><strong>Resultado de consulta:</strong> ${record.legal.summary}</p>
    <p><strong>Multas pendientes:</strong> ${record.legal.pendingFines}</p>
    <p><strong>Restricciones:</strong> ${record.legal.restrictions.join(', ') || 'Sin restricciones detectadas'}</p>
    <p><strong>Observaciones:</strong> ${record.observations || 'Sin observaciones adicionales.'}</p>
    <hr />
    <p><strong>Conclusion:</strong> ${
      record.legal.level === 'clear'
        ? 'El vehiculo no presenta novedades relevantes en la consulta realizada.'
        : 'El vehiculo presenta novedades y requiere revision adicional.'
    }</p>
  `;
}

function saveRecord() {
  if (!currentVehicle || !currentLegal) {
    alert('Primero realice una consulta.');
    return;
  }

  const record = {
    id: `${currentVehicle.plate}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    vehicle: currentVehicle,
    legal: currentLegal,
    observations: $('#observations').value.trim(),
    agent: {
      name: $('#agentName').value.trim() || 'Agente de servicio',
      unit: $('#agentUnit').value.trim() || 'Policia Nacional del Ecuador',
    },
  };

  currentReport = record;
  records = [record, ...records];
  localStorage.setItem('peritaje.records', JSON.stringify(records));
  $('#reportContent').innerHTML = buildReport(record);
  updateDashboard();
  setView('informe');
}

function updateDashboard() {
  $('#metricTotal').textContent = records.length;
  $('#metricClear').textContent = records.filter((record) => record.legal.level === 'clear').length;
  $('#metricWarn').textContent = records.filter((record) => record.legal.level === 'warning').length;
  $('#metricCritical').textContent = records.filter((record) => record.legal.level === 'critical').length;

  const renderItem = (record) => `
    <button class="list-item" data-record="${record.id}">
      <span><strong>${record.vehicle.plate}</strong><br />${record.vehicle.brand} ${record.vehicle.model}</span>
      <span class="badge ${record.legal.level}">${record.legal.summary}</span>
    </button>
  `;

  $('#latestList').innerHTML = records.slice(0, 5).map(renderItem).join('') || '<p>No hay consultas registradas.</p>';
  $('#historyList').innerHTML = records.map(renderItem).join('') || '<p>No existen registros guardados.</p>';

  $$('[data-record]').forEach((item) => {
    item.addEventListener('click', () => {
      const record = records.find((entry) => entry.id === item.dataset.record);
      if (!record) return;
      currentVehicle = record.vehicle;
      currentLegal = record.legal;
      currentReport = record;
      currentCategory = inferCategory(record.vehicle);
      renderDetails(record.vehicle);
      renderLegal(record.legal);
      renderVehicle(currentCategory);
      $('#reportContent').innerHTML = buildReport(record);
      setView('informe');
    });
  });
}

function printCurrentReport() {
  if (!currentReport && currentVehicle && currentLegal) {
    saveRecord();
    return;
  }
  window.print();
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'historial-peritaje.json';
  link.click();
  URL.revokeObjectURL(url);
}

function drawFallbackVehicle() {
  const canvas = $('#vehicleCanvas');
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width * devicePixelRatio));
  canvas.height = Math.max(260, Math.floor(rect.height * devicePixelRatio));
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

  const w = rect.width || 520;
  const h = rect.height || 340;
  ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, '#f8fbff');
  gradient.addColorStop(1, '#dce7f4');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(6, 26, 53, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 24; x < w; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(w / 2, h / 2 + 18);
  ctx.rotate((simpleRotation * Math.PI) / 180);
  const scaleX = currentCategory === 'hatchback' ? 0.82 : currentCategory === 'suv' ? 1.06 : currentCategory === 'truck' ? 1.12 : 1;
  ctx.scale(scaleX, 1);

  const bodyColor =
    currentCategory === 'hatchback'
      ? '#b3261e'
      : currentCategory === 'suv'
        ? '#596579'
        : currentCategory === 'truck'
          ? '#d9e3ef'
          : currentCategory === 'sedan'
            ? '#eef2f7'
            : '#f8fafc';
  const trimColor = '#0e2a52';
  const gold = '#c9a646';
  ctx.fillStyle = 'rgba(17, 24, 39, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 78, currentCategory === 'truck' ? 188 : 165, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  if (currentCategory === 'pickup') drawPickup(ctx, bodyColor, trimColor, gold);
  else if (currentCategory === 'suv') drawSuv(ctx, bodyColor, trimColor);
  else if (currentCategory === 'hatchback') drawHatchback(ctx, bodyColor, trimColor);
  else if (currentCategory === 'truck') drawTruck(ctx, bodyColor, trimColor);
  else drawSedan(ctx, bodyColor, trimColor);

  drawWheels(ctx, currentCategory === 'truck' ? [-122, 118] : [-105, 105], currentCategory === 'suv' || currentCategory === 'truck' ? 34 : 30);

  ctx.restore();
  ctx.fillStyle = '#061a35';
  ctx.font = '700 16px system-ui';
  ctx.fillText(`${categoryLabel(currentCategory)} demo`, 18, 28);
}

function drawPickup(ctx, bodyColor, trimColor, gold) {
  drawBody(ctx, -170, -25, 340, 78, 14, bodyColor);
  drawBody(ctx, -95, -92, 132, 70, 12, trimColor);
  drawWindow(ctx, -78, -80, 42, 32);
  drawWindow(ctx, -30, -80, 46, 32);
  drawBody(ctx, 38, -10, 112, 43, 7, gold);
  drawLine(ctx, 38, -10, 38, 32);
  drawLights(ctx, -168, 0, 164, 0);
}

function drawSuv(ctx, bodyColor, trimColor) {
  drawBody(ctx, -158, -38, 316, 92, 18, bodyColor);
  drawBody(ctx, -92, -105, 168, 78, 14, trimColor);
  drawWindow(ctx, -76, -91, 48, 36);
  drawWindow(ctx, -20, -91, 54, 36);
  drawWindow(ctx, 42, -91, 28, 36);
  drawRoofRails(ctx, -100, -112, 92);
  drawLights(ctx, -155, -8, 151, -8);
}

function drawHatchback(ctx, bodyColor, trimColor) {
  drawBody(ctx, -136, -24, 272, 74, 18, bodyColor);
  drawBody(ctx, -78, -88, 116, 66, 13, trimColor);
  drawWindow(ctx, -63, -77, 40, 30);
  drawWindow(ctx, -18, -77, 42, 30);
  drawLine(ctx, 84, -20, 116, 34);
  drawLights(ctx, -132, 0, 132, 0);
}

function drawSedan(ctx, bodyColor, trimColor) {
  drawBody(ctx, -162, -22, 324, 70, 18, bodyColor);
  drawBody(ctx, -74, -82, 142, 60, 14, trimColor);
  drawWindow(ctx, -60, -72, 48, 28);
  drawWindow(ctx, -6, -72, 54, 28);
  drawLine(ctx, -140, -18, -104, -44);
  drawLine(ctx, 90, -22, 138, -2);
  drawLights(ctx, -158, 0, 158, 0);
}

function drawTruck(ctx, bodyColor, trimColor) {
  drawBody(ctx, -38, -62, 214, 112, 8, bodyColor);
  drawBody(ctx, -176, -42, 128, 92, 12, trimColor);
  drawWindow(ctx, -160, -30, 62, 38);
  drawBody(ctx, -36, 30, 212, 20, 3, '#c9a646');
  drawLights(ctx, -174, -2, 173, 0);
}

function drawBody(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, width, height, radius);
  ctx.fill();
  ctx.strokeStyle = '#0e2a52';
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawWindow(ctx, x, y, width, height) {
  ctx.fillStyle = '#7fb2e5';
  roundRect(ctx, x, y, width, height, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawWheels(ctx, xs, radius) {
  xs.forEach((x) => {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(x, 56, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c7d2de';
    ctx.beginPath();
    ctx.arc(x, 56, radius * 0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, 56, radius * 0.25, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function drawLights(ctx, leftX, leftY, rightX, rightY) {
  ctx.fillStyle = '#f8d56b';
  roundRect(ctx, leftX, leftY, 18, 12, 4);
  ctx.fill();
  ctx.fillStyle = '#ef4444';
  roundRect(ctx, rightX - 18, rightY, 18, 12, 4);
  ctx.fill();
}

function drawLine(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = 'rgba(6, 26, 53, 0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawRoofRails(ctx, x, y, width) {
  ctx.strokeStyle = '#c9a646';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + width, y);
  ctx.stroke();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}


/* ══════════════════════════════════════════════════════════════════
   BRAND MODELS CATALOGUE
   ══════════════════════════════════════════════════════════════════ */
const BRAND_MODELS = [
  { brand:'Toyota',     model:'Hilux',      category:'pickup',    paint:0xf0f4f8, accent:0xc9a646 },
  { brand:'Toyota',     model:'RAV4',       category:'suv',       paint:0x2c3e50, accent:0xc9a646 },
  { brand:'Nissan',     model:'Frontier',   category:'pickup',    paint:0x1a3a5c, accent:0xe8c84a },
  { brand:'Nissan',     model:'X-Trail',    category:'suv',       paint:0x4a6278, accent:0xffffff },
  { brand:'Chevrolet',  model:'Spark',      category:'hatchback', paint:0xb3261e, accent:0xf0f0f0 },
  { brand:'Chevrolet',  model:'Traverse',   category:'suv',       paint:0x2e4057, accent:0xc0c8d4 },
  { brand:'Kia',        model:'Sportage',   category:'suv',       paint:0x596579, accent:0xe8eef7 },
  { brand:'Kia',        model:'Rio',        category:'sedan',     paint:0x8b2fc9, accent:0xf0f0f0 },
  { brand:'Suzuki',     model:'Jimny',      category:'suv',       paint:0x4caf50, accent:0xffffff },
  { brand:'Suzuki',     model:'Swift',      category:'hatchback', paint:0xff5722, accent:0xffffff },
  { brand:'Hyundai',    model:'Tucson',     category:'suv',       paint:0x1565c0, accent:0xe0e0e0 },
  { brand:'Hyundai',    model:'Accent',     category:'sedan',     paint:0xe8eef7, accent:0x0e2a52 },
  { brand:'Mazda',      model:'CX-5',       category:'suv',       paint:0xb71c1c, accent:0x212121 },
  { brand:'Mazda',      model:'3',          category:'sedan',     paint:0x880e4f, accent:0xf8f8f8 },
  { brand:'Ford',       model:'F-150',      category:'pickup',    paint:0x37474f, accent:0xffc107 },
  { brand:'Ford',       model:'Ranger',     category:'pickup',    paint:0xbf360c, accent:0xffd54f },
  { brand:'Volkswagen', model:'Golf',       category:'hatchback', paint:0x283593, accent:0xe8eef7 },
  { brand:'Volkswagen', model:'Tiguan',     category:'suv',       paint:0x37474f, accent:0xdce3ed },
  { brand:'Mitsubishi', model:'L200',       category:'pickup',    paint:0xd32f2f, accent:0xffd600 },
  { brand:'Mitsubishi', model:'Outlander',  category:'suv',       paint:0x1b5e20, accent:0xe0e0e0 },
];

let currentModelIdx = 0;

/* ── inject pill selector below viewer controls ── */
function injectModelSelector() {
  if (document.getElementById('modelSelectorWrap')) return;
  const wrap = document.createElement('div');
  wrap.id = 'modelSelectorWrap';
  wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;padding:6px 0 2px;';

  BRAND_MODELS.forEach((m, i) => {
    const btn = document.createElement('button');
    btn.textContent = m.brand + ' ' + m.model;
    btn.dataset.idx = i;
    btn.style.cssText = 'padding:5px 11px;font-size:0.76rem;font-weight:700;border-radius:20px;border:2px solid #d7dee9;background:#f4f7fb;color:#0e2a52;cursor:pointer;transition:all .15s;';
    btn.addEventListener('click', () => selectBrandModel(i));
    wrap.appendChild(btn);
  });

  const vc = document.querySelector('.viewer-controls');
  if (vc) vc.after(wrap); else document.querySelector('.viewer-wrap')?.after(wrap);
  highlightModelBtn(0);
}

function highlightModelBtn(idx) {
  const btns = document.querySelectorAll('#modelSelectorWrap button');
  btns.forEach((b, i) => {
    b.style.background  = i===idx ? '#061a35' : '#f4f7fb';
    b.style.color       = i===idx ? '#fff'    : '#0e2a52';
    b.style.borderColor = i===idx ? '#c9a646' : '#d7dee9';
  });
}

function selectBrandModel(idx) {
  currentModelIdx = idx;
  highlightModelBtn(idx);
  const m = BRAND_MODELS[idx];
  currentCategory = m.category;
  $('#vehicleCategoryLabel').textContent = m.brand + ' ' + m.model + ' — ' + categoryLabel(m.category);
  if (threeReady) buildBrandVehicle(vehicleGroup, m);
}

/* ══════════════════════════════════════════════════════════════════
   THREE.JS INIT + SCENE
   ══════════════════════════════════════════════════════════════════ */
async function initThree() {
  try {
    const threeModule    = await import('https://unpkg.com/three@0.160.1/build/three.module.js');
    const controlsModule = await import('https://unpkg.com/three@0.160.1/examples/jsm/controls/OrbitControls.js');
    THREE = threeModule;
    OrbitControls = controlsModule.OrbitControls;
    setupThreeScene();
    threeReady = true;
    renderVehicle(currentCategory);
    animateThree();
    injectModelSelector();
  } catch (e) {
    threeReady = false;
    drawFallbackVehicle();
  }
}

function setupThreeScene() {
  scene  = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1f2e);
  scene.fog = new THREE.FogExp2(0x1a1f2e, 0.045);

  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(5.2, 2.8, 5.8);

  renderer = new THREE.WebGLRenderer({ canvas: $('#vehicleCanvas'), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor  = 0.08;
  controls.minDistance    = 3.5;
  controls.maxDistance    = 10;
  controls.target.set(0, 0.3, 0);

  /* Lighting */
  scene.add(new THREE.AmbientLight(0xd0d8f0, 0.55));

  keyLight = new THREE.DirectionalLight(0xfff4e0, 2.2);
  keyLight.position.set(6, 9, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048,2048);
  keyLight.shadow.camera.near   = 0.5;
  keyLight.shadow.camera.far    = 28;
  keyLight.shadow.camera.left   = -6;
  keyLight.shadow.camera.right  = 6;
  keyLight.shadow.camera.top    = 6;
  keyLight.shadow.camera.bottom = -6;
  keyLight.shadow.bias          = -0.001;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x8ab4f8, 0.7);
  fillLight.position.set(-5, 4, -4);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.45);
  rimLight.position.set(0, 3, -7);
  scene.add(rimLight);

  /* Reflective floor */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshStandardMaterial({
      color: 0x23293a, roughness: 0.08, metalness: 0.78,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.56;
  floor.receiveShadow = true;
  scene.add(floor);

  /* Soft ground glow ring */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 4.2, 64),
    new THREE.MeshBasicMaterial({ color: 0x3a4a6a, side: THREE.DoubleSide, transparent:true, opacity:0.35 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.549;
  scene.add(ring);

  vehicleGroup = new THREE.Group();
  scene.add(vehicleGroup);
  resizeViewer();
}

/* ══════════════════════════════════════════════════════════════════
   LOW-POLY HELPERS
   ══════════════════════════════════════════════════════════════════ */

function M(color, metalness=0.45, roughness=0.32) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function Mg(color, opacity=0.52) {
  return new THREE.MeshStandardMaterial({ color, metalness:0.15, roughness:0.04, transparent:true, opacity });
}
function Me(color, emissive, ei=1.2) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity:ei, roughness:0.15, metalness:0.2 });
}

function box(group, w,h,d, x,y,z, mat, rx=0,ry=0,rz=0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z);
  m.rotation.set(rx,ry,rz);
  m.castShadow=true; m.receiveShadow=true;
  group.add(m); return m;
}
function cyl(group, rt,rb,h,seg, x,y,z, mat, rx=0,ry=0,rz=0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,seg), mat);
  m.position.set(x,y,z);
  m.rotation.set(rx,ry,rz);
  m.castShadow=true; m.receiveShadow=true;
  group.add(m); return m;
}

/* Low-poly bodyshell via custom BufferGeometry (extruded profile) */
function makeCarBody(pts, halfW, mat) {
  // pts = [{x,y}] side profile, extruded along Z
  const shape = new THREE.Shape();
  pts.forEach((p,i) => i===0 ? shape.moveTo(p.x,p.y) : shape.lineTo(p.x,p.y));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: halfW*2, bevelEnabled:false });
  geo.translate(0, 0, -halfW);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow=true; m.receiveShadow=true;
  return m;
}

function addWheel(group, x, z, r=0.38, paint=0x111827) {
  // Tire torus
  const tire = new THREE.Mesh(new THREE.TorusGeometry(r*0.76,r*0.24,14,40), M(0x111827,0.08,0.9));
  tire.rotation.z = Math.PI/2;
  tire.position.set(x,-0.36,z);
  tire.castShadow=true; group.add(tire);

  // Rim disc
  cyl(group, r*0.55,r*0.55,0.28,32, x,-0.36,z, M(0xc8d0dc,0.82,0.18), 0,0,Math.PI/2);

  // Hub
  cyl(group, r*0.18,r*0.18,0.3,16,  x,-0.36,z, M(0xe8eef7,0.7,0.15), 0,0,Math.PI/2);

  // 5 spokes
  for(let i=0;i<5;i++){
    const a=(i/5)*Math.PI*2;
    const sy=Math.sin(a)*r*0.37, sz=Math.cos(a)*r*0.37;
    const spoke=new THREE.Mesh(new THREE.BoxGeometry(0.27,0.052,r*0.34), M(0xb0bcc8,0.7,0.25));
    spoke.position.set(x,-0.36+sy,z+sz);
    spoke.rotation.set(a,0,Math.PI/2);
    group.add(spoke);
  }

  // Brake disc (accent colour behind spokes)
  cyl(group, r*0.38,r*0.38,0.06,24, x,-0.36,z, M(paint,0.6,0.4), 0,0,Math.PI/2);
}

function addLight(group, x,y,z, isRear=false) {
  const col  = isRear ? 0xff1a1a : 0xfff0a0;
  const emit = isRear ? 0xff0000 : 0xffee55;
  box(group, 0.07,0.13,0.28, x,y,z, Me(col,emit,isRear?1.0:1.4));
}

function addGlassPane(group, w,h,d, x,y,z, rx=0,ry=0,rz=0, opacity=0.55) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), Mg(0x88bbdd,opacity));
  m.position.set(x,y,z);
  m.rotation.set(rx,ry,rz);
  group.add(m);
}

/* ══════════════════════════════════════════════════════════════════
   PER-CATEGORY LOW-POLY BUILDERS  (brand paint + accent passed in)
   ══════════════════════════════════════════════════════════════════ */

function buildPickupLP(g, paint, accent) {
  const P=M(paint,0.55,0.26), A=M(accent,0.7,0.2), D=M(0x0e1a2c,0.5,0.55);
  const CH=M(0xd4dde6,0.85,0.12);

  // --- body shell using extruded side profile ---
  const bodyPts = [
    {x:-1.92,y:-0.22},{x:1.92,y:-0.22},{x:1.92,y:0.22},
    {x:1.6,y:0.22},{x:1.5,y:0.32},{x:-0.02,y:0.32},
    {x:-0.02,y:0.22},{x:-1.92,y:0.22},
  ];
  const bodyMesh = makeCarBody(bodyPts, 0.76, P);
  bodyMesh.position.set(0,0,0); g.add(bodyMesh);

  // cab top (slanted)
  const cabPts = [
    {x:-1.08,y:0.3},{x:0.04,y:0.3},{x:0.04,y:0.95},
    {x:-0.92,y:1.0},{x:-1.08,y:0.95},
  ];
  const cabMesh = makeCarBody(cabPts, 0.72, M(paint,0.5,0.3));
  g.add(cabMesh);

  // windshield (angled)
  addGlassPane(g, 0.07,0.56,1.32, 0.04,0.64,0, 0,0,-0.38, 0.62);
  // rear cab glass
  addGlassPane(g, 0.05,0.38,1.28, -1.04,0.68,0, 0,0,0.12, 0.5);
  // side windows
  addGlassPane(g, 0.72,0.28,0.04, -0.54,0.72,0.74);
  addGlassPane(g, 0.72,0.28,0.04, -0.54,0.72,-0.74);

  // cargo bed floor
  box(g, 1.56,0.06,1.58, 0.94,0.22,0, A);
  box(g, 0.06,0.38,1.58, 1.7,0.06,0, P);  // tailgate
  box(g, 1.56,0.38,0.06, 0.94,0.06,0.8,  P);
  box(g, 1.56,0.38,0.06, 0.94,0.06,-0.8, P);

  // roll bar
  box(g, 0.07,0.42,1.44, 0.04,0.68,0, CH);

  // hood
  box(g, 1.24,0.07,1.52, 1.02,0.34,0, P);

  // front bumper
  box(g, 0.15,0.3,1.58, 1.82,-0.02,0, D);
  box(g, 0.16,0.07,1.48, 1.83,0.1,0, CH);

  // rear bumper
  box(g, 0.12,0.26,1.58, -1.76,-0.02,0, D);

  // grille + bars
  box(g, 0.08,0.22,1.08, 1.8,-0.04,0, M(0x050e1a,0.9,0.25));
  for(let i=0;i<3;i++) box(g, 0.09,0.03,0.96, 1.81,-0.1+i*0.07,0, M(accent,0.88,0.14));

  // headlights
  addLight(g,  1.79, 0.14,  0.56);
  addLight(g,  1.79, 0.14, -0.56);
  addLight(g, -1.74, 0.1,   0.54, true);
  addLight(g, -1.74, 0.1,  -0.54, true);

  // mirrors
  box(g, 0.07,0.12,0.2, 0.06,0.68,0.84, M(0x111827,0.3,0.55));
  box(g, 0.07,0.12,0.2, 0.06,0.68,-0.84,M(0x111827,0.3,0.55));

  // side steps
  box(g, 1.6,0.07,0.12, -0.32,-0.22,0.88, M(0x222222,0.3,0.8));
  box(g, 1.6,0.07,0.12, -0.32,-0.22,-0.88,M(0x222222,0.3,0.8));

  addWheel(g, -0.82, 0.74, 0.4, paint);
  addWheel(g, -0.82,-0.74, 0.4, paint);
  addWheel(g,  1.12, 0.74, 0.4, paint);
  addWheel(g,  1.12,-0.74, 0.4, paint);
}

function buildSuvLP(g, paint, accent) {
  const P=M(paint,0.55,0.26), A=M(accent,0.7,0.2), D=M(0x0e1a2c,0.5,0.55);
  const CH=M(0xd4dde6,0.85,0.12);

  // lower body
  const lbPts=[
    {x:-1.85,y:-0.24},{x:1.85,y:-0.24},{x:1.85,y:0.24},
    {x:1.6,y:0.32},{x:-1.6,y:0.32},{x:-1.85,y:0.24},
  ];
  g.add(Object.assign(makeCarBody(lbPts,0.82,P),{}));

  // upper cabin (tall)
  const cabPts=[
    {x:-1.18,y:0.3},{x:1.0,y:0.3},{x:1.0,y:0.98},
    {x:0.82,y:1.06},{x:-1.06,y:1.06},{x:-1.18,y:0.98},
  ];
  g.add(makeCarBody(cabPts,0.78,M(paint,0.5,0.3)));

  // windshield
  addGlassPane(g, 0.07,0.72,1.44, 0.98,0.68,0, 0,0,-0.35, 0.6);
  // rear glass
  addGlassPane(g, 0.06,0.58,1.44, -1.14,0.7,0, 0,0,0.18, 0.5);
  // side windows (3 panes per side)
  [{x:0.18,w:0.52},{x:-0.46,w:0.44},{x:-1.02,w:0.28}].forEach(p=>{
    addGlassPane(g, p.w,0.34,0.04, p.x,0.74, 0.84);
    addGlassPane(g, p.w,0.34,0.04, p.x,0.74,-0.84);
  });

  // roof + rails
  box(g, 2.1,0.09,1.62, -0.12,1.07,0, M(paint,0.45,0.32));
  box(g, 1.96,0.06,0.06, -0.12,1.14, 0.78, CH);
  box(g, 1.96,0.06,0.06, -0.12,1.14,-0.78, CH);

  // hood
  box(g, 1.18,0.09,1.68, 1.28,0.36,0, P);
  // skid plate
  box(g, 0.18,0.1,1.66, 1.9,-0.18,0, M(0x1a1a1a,0.3,0.85));

  // front bumper
  box(g, 0.16,0.34,1.7, 1.9,-0.02,0, D);
  box(g, 0.17,0.08,1.58, 1.91,0.12,0, CH);

  // rear bumper
  box(g, 0.14,0.28,1.7, -1.88,-0.02,0, D);

  // grille
  box(g, 0.08,0.26,1.14, 1.88,-0.02,0, M(0x050e1a,0.9,0.25));
  for(let i=0;i<3;i++) box(g, 0.09,0.035,1.02, 1.89,-0.08+i*0.09,0, M(accent,0.88,0.14));

  // cladding
  box(g, 3.56,0.2,0.04, 0,-0.08, 0.86, M(0x222222,0.2,0.85));
  box(g, 3.56,0.2,0.04, 0,-0.08,-0.86, M(0x222222,0.2,0.85));

  addLight(g,  1.87, 0.14,  0.62);
  addLight(g,  1.87, 0.14, -0.62);
  addLight(g, -1.85, 0.14,  0.6, true);
  addLight(g, -1.85, 0.14, -0.6, true);

  box(g, 0.08,0.14,0.22,  0.98,0.78, 0.9,  M(0x111827,0.3,0.55));
  box(g, 0.08,0.14,0.22,  0.98,0.78,-0.9,  M(0x111827,0.3,0.55));

  // running boards
  box(g, 2.3,0.07,0.14, -0.08,-0.26, 0.94, M(0x222222,0.3,0.8));
  box(g, 2.3,0.07,0.14, -0.08,-0.26,-0.94, M(0x222222,0.3,0.8));

  addWheel(g, -1.02, 0.8, 0.43, paint);
  addWheel(g, -1.02,-0.8, 0.43, paint);
  addWheel(g,  1.12, 0.8, 0.43, paint);
  addWheel(g,  1.12,-0.8, 0.43, paint);
}

function buildHatchbackLP(g, paint, accent) {
  const P=M(paint,0.55,0.26), A=M(accent,0.7,0.2), D=M(0x0e1a2c,0.5,0.55);
  const CH=M(0xd4dde6,0.85,0.12);

  // body with roofline
  const bPts=[
    {x:-1.56,y:-0.2},{x:1.56,y:-0.2},{x:1.56,y:0.2},
    {x:1.4,y:0.28},{x:-1.3,y:0.28},{x:-1.56,y:0.18},
  ];
  g.add(makeCarBody(bPts, 0.72, P));

  // cabin – hatch has steep rear
  const cPts=[
    {x:-1.02,y:0.26},{x:0.74,y:0.26},
    {x:0.74,y:0.9},{x:0.58,y:0.98},
    {x:-0.92,y:0.98},{x:-1.02,y:0.78},
  ];
  g.add(makeCarBody(cPts, 0.68, M(paint,0.5,0.3)));

  // windshield (steep)
  addGlassPane(g, 0.07,0.6,1.28, 0.72,0.62,0, 0,0,-0.46, 0.62);
  // hatch rear glass (very steep)
  addGlassPane(g, 0.06,0.56,1.28, -0.96,0.64,0, 0,0,0.55, 0.52);
  // side
  addGlassPane(g, 0.56,0.3,0.04,  0.1,0.66, 0.73);
  addGlassPane(g, 0.42,0.28,0.04,-0.52,0.64, 0.73);
  addGlassPane(g, 0.56,0.3,0.04,  0.1,0.66,-0.73);
  addGlassPane(g, 0.42,0.28,0.04,-0.52,0.64,-0.73);

  // roof
  box(g, 1.58,0.08,1.34, -0.2,0.98,0, M(paint,0.45,0.3));

  // hood
  box(g, 1.02,0.08,1.44, 1.08,0.3,0, P);

  // bumpers
  box(g, 0.13,0.26,1.44, 1.62,-0.04,0, D);
  box(g, 0.14,0.06,1.36, 1.63,0.08,0, CH);
  box(g, 0.11,0.22,1.44, -1.6,-0.04,0, D);

  // grille (smaller – sport)
  box(g, 0.08,0.16,0.88, 1.61,-0.05,0, M(0x050e1a,0.9,0.25));
  for(let i=0;i<2;i++) box(g, 0.09,0.03,0.78, 1.62,-0.08+i*0.08,0, M(accent,0.88,0.14));

  addLight(g,  1.6, 0.1,  0.52);
  addLight(g,  1.6, 0.1, -0.52);
  addLight(g, -1.58,0.1,  0.5, true);
  addLight(g, -1.58,0.1, -0.5, true);

  // sport stripe (accent)
  box(g, 2.8,0.06,1.46, -0.1,-0.04,0, A);

  box(g, 0.07,0.12,0.2, 0.68,0.54, 0.76, M(0x111827,0.3,0.55));
  box(g, 0.07,0.12,0.2, 0.68,0.54,-0.76, M(0x111827,0.3,0.55));

  addWheel(g, -0.82,0.68,0.34,paint);
  addWheel(g, -0.82,-0.68,0.34,paint);
  addWheel(g,  0.92,0.68,0.34,paint);
  addWheel(g,  0.92,-0.68,0.34,paint);
}

function buildSedanLP(g, paint, accent) {
  const P=M(paint,0.55,0.26), A=M(accent,0.7,0.2), D=M(0x0e1a2c,0.5,0.55);
  const CH=M(0xd4dde6,0.85,0.12);

  // 3-box classic profile
  const bPts=[
    {x:-1.82,y:-0.2},{x:1.82,y:-0.2},{x:1.82,y:0.22},
    {x:1.6,y:0.3},{x:-1.5,y:0.3},{x:-1.82,y:0.22},
  ];
  g.add(makeCarBody(bPts, 0.74, P));

  const cPts=[
    {x:-0.96,y:0.28},{x:0.82,y:0.28},
    {x:0.82,y:0.86},{x:0.66,y:0.94},
    {x:-0.82,y:0.94},{x:-0.96,y:0.76},
  ];
  g.add(makeCarBody(cPts, 0.7, M(paint,0.5,0.3)));

  // windshield
  addGlassPane(g, 0.06,0.54,1.36, 0.8,0.6,0, 0,0,-0.36, 0.62);
  // rear window
  addGlassPane(g, 0.06,0.46,1.36, -0.92,0.58,0, 0,0,0.38, 0.5);
  // side
  [{x:0.22,w:0.56},{x:-0.42,w:0.44}].forEach(p=>{
    addGlassPane(g, p.w,0.3,0.04, p.x,0.64, 0.72);
    addGlassPane(g, p.w,0.3,0.04, p.x,0.64,-0.72);
  });

  // roof
  box(g, 1.66,0.08,1.38, -0.12,0.95,0, M(paint,0.45,0.3));

  // hood + trunk
  box(g, 1.16,0.08,1.46, 1.1,0.3,0, P);
  box(g, 0.64,0.22,1.46, -1.34,0.2,0, P);

  // bumpers
  box(g, 0.13,0.24,1.5, 1.76,-0.02,0, D);
  box(g, 0.14,0.06,1.42, 1.77,0.08,0, CH);
  box(g, 0.12,0.22,1.5, -1.74,-0.02,0, D);
  box(g, 0.13,0.06,1.42, -1.75,0.07,0, CH);

  // grille
  box(g, 0.08,0.18,0.96, 1.75,-0.04,0, M(0x050e1a,0.9,0.25));
  for(let i=0;i<3;i++) box(g, 0.09,0.032,0.86, 1.76,-0.1+i*0.07,0, M(accent,0.88,0.14));

  addLight(g,  1.74,0.1,  0.54);
  addLight(g,  1.74,0.1, -0.54);
  addLight(g, -1.72,0.1,  0.52, true);
  addLight(g, -1.72,0.1, -0.52, true);

  // waistline stripe
  box(g, 3.4,0.04,1.5, 0,0.08,0, A);

  box(g, 0.07,0.12,0.2, 0.78,0.52, 0.77, M(0x111827,0.3,0.55));
  box(g, 0.07,0.12,0.2, 0.78,0.52,-0.77, M(0x111827,0.3,0.55));

  addWheel(g, -0.9, 0.72,0.36,paint);
  addWheel(g, -0.9,-0.72,0.36,paint);
  addWheel(g,  1.0, 0.72,0.36,paint);
  addWheel(g,  1.0,-0.72,0.36,paint);
}

/* ══════════════════════════════════════════════════════════════════
   MAIN BRAND VEHICLE BUILDER
   ══════════════════════════════════════════════════════════════════ */

function buildBrandVehicle(group, brandModel) {
  // clear previous
  while(group.children.length) {
    const c = group.children[0];
    if(c.geometry) c.geometry.dispose();
    if(c.material) { if(Array.isArray(c.material)) c.material.forEach(m=>m.dispose()); else c.material.dispose(); }
    group.remove(c);
  }

  const { category, paint, accent } = brandModel;

  if      (category==='pickup')   buildPickupLP(group, paint, accent);
  else if (category==='suv')      buildSuvLP(group, paint, accent);
  else if (category==='hatchback')buildHatchbackLP(group, paint, accent);
  else                            buildSedanLP(group, paint, accent);

  // shadow caster disk
  const shadow=new THREE.Mesh(
    new THREE.EllipseCurve ? new THREE.CircleGeometry(2.2,48) : new THREE.CircleGeometry(2.2,48),
    new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28})
  );
  shadow.rotation.x=-Math.PI/2;
  shadow.position.y=-0.545;
  group.add(shadow);

  group.rotation.y = -0.45;
}

function renderThreeVehicle(category) {
  if(!threeReady||!scene) return;

  // Try to match current brand model to category; if no match pick first of that category
  let idx = currentModelIdx;
  const cur = BRAND_MODELS[idx];
  if(!cur || cur.category !== category) {
    const found = BRAND_MODELS.findIndex(m=>m.category===category);
    idx = found>=0 ? found : 0;
    currentModelIdx = idx;
    highlightModelBtn(idx);
  }

  vehicleGroup = vehicleGroup || new THREE.Group();
  buildBrandVehicle(vehicleGroup, BRAND_MODELS[idx]);
}

function renderVehicle(category) {
  currentCategory = category;
  if (threeReady) renderThreeVehicle(category);
  else drawFallbackVehicle();
}

function resizeViewer() {
  const wrap = $('.viewer-wrap');
  if (!wrap) return;
  if (!threeReady || !renderer || !camera) { drawFallbackVehicle(); return; }
  const width  = wrap.clientWidth  || 520;
  const height = wrap.clientHeight || 340;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animateThree() {
  if (threeReady && renderer && scene && camera) {
    controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animateThree);
}

function bindEvents() {
  $$('.nav-item').forEach((item) => item.addEventListener('click', () => setView(item.dataset.view)));
  $('#quickDemo').addEventListener('click', () => consultVehicle($('#quickPlate').value || 'ABC1234'));
  $('#consultDemo').addEventListener('click', () => consultVehicle($('#plateInput').value || 'ABC1234'));
  $('#consultManual').addEventListener('click', () => consultVehicle($('#plateInput').value || 'ABC1234'));
  $('#saveRecord').addEventListener('click', saveRecord);
  $('#printReport').addEventListener('click', printCurrentReport);
  $('#printReportAlt').addEventListener('click', printCurrentReport);
  $('#downloadJson').addEventListener('click', downloadJson);
  $('#pickImage').addEventListener('click', () => $('#imageInput').click());
  $('#imageInput').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    $('#platePreview').src = URL.createObjectURL(file);
    $('#platePreview').classList.remove('hidden');
  });
  $('#plateInput').addEventListener('input', (event) => { event.target.value = normalizePlate(event.target.value); });
  $('#quickPlate').addEventListener('input', (event) => { event.target.value = normalizePlate(event.target.value); });

  $('#rotateModel').addEventListener('click', () => {
    if (threeReady && vehicleGroup) {
      // 360 auto-spin
      let start=null;
      const from=vehicleGroup.rotation.y;
      function spin(ts){ if(!start)start=ts; const p=Math.min((ts-start)/1200,1); vehicleGroup.rotation.y=from+p*Math.PI*2; if(p<1)requestAnimationFrame(spin); }
      requestAnimationFrame(spin);
    }
    simpleRotation+=35; drawFallbackVehicle();
  });
  $('#lightModel').addEventListener('click', () => {
    lightMode=(lightMode+1)%3;
    if(keyLight) keyLight.intensity=[0.9,2.2,3.0][lightMode];
    drawFallbackVehicle();
  });
  $('#resetCamera').addEventListener('click', () => {
    if(threeReady&&camera&&controls){
      camera.position.set(5.2,2.8,5.8);
      controls.target.set(0,0.3,0);
    }
    simpleRotation=0; drawFallbackVehicle();
  });
  window.addEventListener('resize', resizeViewer);
}

bindEvents();
renderPhotoInputs();
renderVehicle('pickup');
updateDashboard();
initThree();
