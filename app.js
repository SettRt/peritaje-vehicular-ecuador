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

async function initThree() {
  try {
    const threeModule = await import('https://unpkg.com/three@0.160.1/build/three.module.js');
    const controlsModule = await import('https://unpkg.com/three@0.160.1/examples/jsm/controls/OrbitControls.js');
    THREE = threeModule;
    OrbitControls = controlsModule.OrbitControls;
    setupThreeScene();
    threeReady = true;
    renderVehicle(currentCategory);
    animateThree();
  } catch (error) {
    threeReady = false;
    drawFallbackVehicle();
  }
}

function setupThreeScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(4.8, 2.6, 5.8);

  renderer = new THREE.WebGLRenderer({ canvas: $('#vehicleCanvas'), antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 3.4;
  controls.maxDistance = 9;

  scene.add(new THREE.AmbientLight(0xdce8f4, 0.72));
  keyLight = new THREE.DirectionalLight(0xfff8e8, 1.5);
  keyLight.position.set(5, 7, 5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 24;
  keyLight.shadow.camera.left = -5;
  keyLight.shadow.camera.right = 5;
  keyLight.shadow.camera.top = 5;
  keyLight.shadow.camera.bottom = -5;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xc8d8f0, 0.55);
  fillLight.position.set(-4, 3, -4);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.38);
  rimLight.position.set(0, 2, -6);
  scene.add(rimLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(5.0, 72),
    new THREE.MeshStandardMaterial({ color: 0xcfd8e8, roughness: 0.92, metalness: 0.04 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.54;
  ground.receiveShadow = true;
  scene.add(ground);
  const gridHelper = new THREE.GridHelper(8, 16, 0xb8c8dc, 0xd0dcea);
  gridHelper.position.y = -0.535;
  gridHelper.material.opacity = 0.55;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  vehicleGroup = new THREE.Group();
  scene.add(vehicleGroup);
  resizeViewer();
}

/* ─── Material helpers ─────────────────────────────────────────── */

function mat(color, metalness = 0.35, roughness = 0.28) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}

function glassMat(color = 0x7fb2e5, opacity = 0.55) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: 0.05, transparent: true, opacity });
}

function addMesh(group, geometry, material, position = [0,0,0], rotation = [0,0,0], castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  if (castShadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
  group.add(mesh);
  return mesh;
}

/* ─── Shared sub-components ────────────────────────────────────── */

function addDetailedWheel(group, x, z, radius = 0.38) {
  const wr = radius;
  const ww = 0.26;

  // Tire
  const tire = new THREE.Mesh(new THREE.TorusGeometry(wr * 0.78, wr * 0.22, 16, 48), mat(0x111827, 0.08, 0.88));
  tire.rotation.z = Math.PI / 2;
  tire.position.set(x, -0.32, z);
  tire.castShadow = true;
  group.add(tire);

  // Wheel disc (fills torus hole)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.56, wr * 0.56, ww, 36), mat(0xc0c8d4, 0.72, 0.22));
  disc.rotation.z = Math.PI / 2;
  disc.position.set(x, -0.32, z);
  disc.castShadow = true;
  group.add(disc);

  // Hub cap
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.22, wr * 0.22, ww + 0.01, 20), mat(0xe8eef7, 0.6, 0.2));
  hub.rotation.z = Math.PI / 2;
  hub.position.set(x, -0.32, z);
  group.add(hub);

  // Spokes (5 spokes)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spokeLen = wr * 0.33;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(ww * 0.95, 0.055, spokeLen), mat(0xb8c3cf, 0.65, 0.25));
    spoke.position.set(x, -0.32 + Math.sin(angle) * wr * 0.39, z + Math.cos(angle) * wr * 0.39);
    spoke.rotation.set(angle, 0, Math.PI / 2);
    group.add(spoke);
  }
}

function addMirror(group, x, y, z) {
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.22), mat(0x1a1a2e, 0.3, 0.5));
  mirror.position.set(x, y, z);
  group.add(mirror);
}

function addHeadlight(group, x, y, z, isRear = false) {
  const color = isRear ? 0xff2222 : 0xfff5cc;
  const intensity = isRear ? 0.6 : 1.0;
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.28), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.1 }));
  light.position.set(x, y, z);
  group.add(light);
}

function addGrille(group, x, y, z, w = 0.5, h = 0.18) {
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, w), mat(0x0e1a2e, 0.8, 0.3));
  grille.position.set(x, y, z);
  group.add(grille);
  // Horizontal bars
  for (let i = 0; i < 3; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, w * 0.9), mat(0xc9a646, 0.85, 0.15));
    bar.position.set(x, y - h / 2 + h * (i + 1) / 4, z);
    group.add(bar);
  }
}

/* ─── Category-specific builders ───────────────────────────────── */

function buildPickup(group, paint) {
  const trim = 0x0e2a52;
  const chrome = 0xd4dde6;

  // Chassis / frame rails
  addMesh(group, new THREE.BoxGeometry(3.8, 0.13, 0.16), mat(0x1a1a2e, 0.6, 0.5), [-0.05, -0.19, 0.52]);
  addMesh(group, new THREE.BoxGeometry(3.8, 0.13, 0.16), mat(0x1a1a2e, 0.6, 0.5), [-0.05, -0.19, -0.52]);

  // Main body lower
  addMesh(group, new THREE.BoxGeometry(3.8, 0.42, 1.58), mat(paint, 0.5, 0.28), [-0.05, -0.02, 0]);

  // Cab upper structure
  addMesh(group, new THREE.BoxGeometry(1.38, 0.36, 1.45), mat(paint, 0.5, 0.28), [-0.62, 0.38, 0]);

  // Cab roof (slightly curved via sphere segment look – approximated with a flattened box)
  addMesh(group, new THREE.BoxGeometry(1.3, 0.1, 1.42), mat(paint, 0.45, 0.32), [-0.62, 0.56, 0]);

  // A-pillar (windshield slant) – thin slanted box
  const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 1.38), mat(trim, 0.3, 0.5));
  aPillar.position.set(0.07, 0.3, 0);
  aPillar.rotation.set(0, 0, -0.42);
  group.add(aPillar);

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.18), glassMat());
  windshield.position.set(0.06, 0.3, 0);
  windshield.rotation.set(0, 0, -0.42);
  group.add(windshield);

  // Rear window
  addMesh(group, new THREE.BoxGeometry(0.05, 0.3, 1.1), glassMat(0x6aa0d4, 0.5), [-1.25, 0.42, 0]);

  // Side windows (left/right)
  addMesh(group, new THREE.BoxGeometry(0.7, 0.26, 0.04), glassMat(0x6aa0d4, 0.5), [-0.62, 0.42, 0.73]);
  addMesh(group, new THREE.BoxGeometry(0.7, 0.26, 0.04), glassMat(0x6aa0d4, 0.5), [-0.62, 0.42, -0.73]);

  // Bed (cargo area)
  addMesh(group, new THREE.BoxGeometry(1.42, 0.06, 1.56), mat(0x1a1a2e, 0.3, 0.7), [0.82, 0.2, 0]);
  addMesh(group, new THREE.BoxGeometry(0.06, 0.36, 1.56), mat(paint, 0.5, 0.28), [1.52, 0.05, 0]);  // tailgate
  addMesh(group, new THREE.BoxGeometry(1.42, 0.36, 0.07), mat(paint, 0.5, 0.28), [0.82, 0.05, 0.74]);
  addMesh(group, new THREE.BoxGeometry(1.42, 0.36, 0.07), mat(paint, 0.5, 0.28), [0.82, 0.05, -0.74]);

  // Roll bar / sports bar
  addMesh(group, new THREE.BoxGeometry(0.07, 0.34, 1.44), mat(chrome, 0.82, 0.14), [0.07, 0.38, 0]);

  // Hood / bonnet
  addMesh(group, new THREE.BoxGeometry(1.12, 0.08, 1.52), mat(paint, 0.55, 0.24), [0.82, 0.21, 0]);

  // Front bumper
  addMesh(group, new THREE.BoxGeometry(0.14, 0.22, 1.56), mat(0x111827, 0.4, 0.6), [1.62, -0.06, 0]);
  addMesh(group, new THREE.BoxGeometry(0.15, 0.07, 1.48), mat(chrome, 0.85, 0.12), [1.63, 0.06, 0]);

  // Rear bumper
  addMesh(group, new THREE.BoxGeometry(0.12, 0.22, 1.56), mat(0x111827, 0.4, 0.6), [-1.56, -0.06, 0]);

  // Headlights
  addHeadlight(group, 1.6, 0.12, 0.55);
  addHeadlight(group, 1.6, 0.12, -0.55);
  addHeadlight(group, -1.54, 0.1, 0.52, true);
  addHeadlight(group, -1.54, 0.1, -0.52, true);

  addGrille(group, 1.6, -0.04, 0, 0.85, 0.16);

  // Mirrors
  addMirror(group, -0.08, 0.38, 0.82);
  addMirror(group, -0.08, 0.38, -0.82);

  // Door handles
  for (let sx of [-0.3, -0.9]) {
    addMesh(group, new THREE.BoxGeometry(0.22, 0.04, 0.04), mat(chrome, 0.9, 0.1), [sx, 0.08, 0.76]);
    addMesh(group, new THREE.BoxGeometry(0.22, 0.04, 0.04), mat(chrome, 0.9, 0.1), [sx, 0.08, -0.76]);
  }

  // Wheels
  addDetailedWheel(group, -0.68, 0.72);
  addDetailedWheel(group, -0.68, -0.72);
  addDetailedWheel(group, 1.08, 0.72);
  addDetailedWheel(group, 1.08, -0.72);

  // Running boards / side steps
  addMesh(group, new THREE.BoxGeometry(1.5, 0.06, 0.12), mat(0x2a2a2a, 0.3, 0.8), [-0.3, -0.22, 0.84]);
  addMesh(group, new THREE.BoxGeometry(1.5, 0.06, 0.12), mat(0x2a2a2a, 0.3, 0.8), [-0.3, -0.22, -0.84]);
}

function buildSuv(group, paint) {
  const trim = 0x0e2a52;
  const chrome = 0xd4dde6;

  // Chassis
  addMesh(group, new THREE.BoxGeometry(3.6, 0.13, 0.16), mat(0x1a1a2e, 0.6, 0.5), [0, -0.22, 0.58]);
  addMesh(group, new THREE.BoxGeometry(3.6, 0.13, 0.16), mat(0x1a1a2e, 0.6, 0.5), [0, -0.22, -0.58]);

  // Lower body
  addMesh(group, new THREE.BoxGeometry(3.6, 0.48, 1.68), mat(paint, 0.5, 0.28), [0, -0.02, 0]);

  // Upper body (cabin – taller than sedan)
  addMesh(group, new THREE.BoxGeometry(2.1, 0.72, 1.52), mat(paint, 0.5, 0.28), [-0.12, 0.42, 0]);

  // Roof
  addMesh(group, new THREE.BoxGeometry(2.0, 0.1, 1.48), mat(paint, 0.45, 0.32), [-0.12, 0.78, 0]);

  // Roof rails
  addMesh(group, new THREE.BoxGeometry(1.85, 0.055, 0.06), mat(chrome, 0.85, 0.12), [-0.12, 0.84, 0.72]);
  addMesh(group, new THREE.BoxGeometry(1.85, 0.055, 0.06), mat(chrome, 0.85, 0.12), [-0.12, 0.84, -0.72]);

  // Windshield
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.64, 1.38), glassMat());
  ws.position.set(0.88, 0.38, 0);
  ws.rotation.set(0, 0, -0.38);
  group.add(ws);

  // Rear glass
  const rg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.52, 1.38), glassMat(0x6aa0d4, 0.5));
  rg.position.set(-1.12, 0.44, 0);
  rg.rotation.set(0, 0, 0.22);
  group.add(rg);

  // Side windows
  addMesh(group, new THREE.BoxGeometry(0.58, 0.3, 0.04), glassMat(0x6aa0d4, 0.5), [0.28, 0.5, 0.77]);
  addMesh(group, new THREE.BoxGeometry(0.46, 0.28, 0.04), glassMat(0x6aa0d4, 0.5), [-0.46, 0.5, 0.77]);
  addMesh(group, new THREE.BoxGeometry(0.26, 0.26, 0.04), glassMat(0x6aa0d4, 0.5), [-0.95, 0.5, 0.77]);
  addMesh(group, new THREE.BoxGeometry(0.58, 0.3, 0.04), glassMat(0x6aa0d4, 0.5), [0.28, 0.5, -0.77]);
  addMesh(group, new THREE.BoxGeometry(0.46, 0.28, 0.04), glassMat(0x6aa0d4, 0.5), [-0.46, 0.5, -0.77]);
  addMesh(group, new THREE.BoxGeometry(0.26, 0.26, 0.04), glassMat(0x6aa0d4, 0.5), [-0.95, 0.5, -0.77]);

  // Hood
  addMesh(group, new THREE.BoxGeometry(1.1, 0.09, 1.62), mat(paint, 0.55, 0.24), [1.08, 0.24, 0]);

  // Front bumper / skid plate
  addMesh(group, new THREE.BoxGeometry(0.16, 0.3, 1.66), mat(0x1a1a2e, 0.4, 0.6), [1.74, -0.06, 0]);
  addMesh(group, new THREE.BoxGeometry(0.17, 0.1, 1.6), mat(0x2a2a2a, 0.3, 0.8), [1.75, -0.22, 0]); // underbody skid

  // Rear bumper
  addMesh(group, new THREE.BoxGeometry(0.14, 0.28, 1.66), mat(0x1a1a2e, 0.4, 0.6), [-1.72, -0.06, 0]);

  addHeadlight(group, 1.72, 0.12, 0.58);
  addHeadlight(group, 1.72, 0.12, -0.58);
  addHeadlight(group, -1.7, 0.12, 0.56, true);
  addHeadlight(group, -1.7, 0.12, -0.56, true);

  addGrille(group, 1.72, -0.02, 0, 0.92, 0.2);

  addMirror(group, 0.86, 0.52, 0.88);
  addMirror(group, 0.86, 0.52, -0.88);

  // Door handles
  for (let sx of [0.32, -0.44]) {
    addMesh(group, new THREE.BoxGeometry(0.24, 0.045, 0.04), mat(chrome, 0.9, 0.1), [sx, 0.06, 0.85]);
    addMesh(group, new THREE.BoxGeometry(0.24, 0.045, 0.04), mat(chrome, 0.9, 0.1), [sx, 0.06, -0.85]);
  }

  // Side cladding (plastic lower trim)
  addMesh(group, new THREE.BoxGeometry(3.3, 0.18, 0.04), mat(0x2a2a2a, 0.2, 0.85), [0, -0.12, 0.85]);
  addMesh(group, new THREE.BoxGeometry(3.3, 0.18, 0.04), mat(0x2a2a2a, 0.2, 0.85), [0, -0.12, -0.85]);

  // Wheels (slightly bigger for SUV)
  addDetailedWheel(group, -0.88, 0.76, 0.41);
  addDetailedWheel(group, -0.88, -0.76, 0.41);
  addDetailedWheel(group, 1.08, 0.76, 0.41);
  addDetailedWheel(group, 1.08, -0.76, 0.41);

  // Running boards
  addMesh(group, new THREE.BoxGeometry(2.2, 0.06, 0.14), mat(0x2a2a2a, 0.3, 0.8), [-0.06, -0.24, 0.9]);
  addMesh(group, new THREE.BoxGeometry(2.2, 0.06, 0.14), mat(0x2a2a2a, 0.3, 0.8), [-0.06, -0.24, -0.9]);
}

function buildHatchback(group, paint) {
  const trim = 0x0e2a52;
  const chrome = 0xd4dde6;

  // Lower body
  addMesh(group, new THREE.BoxGeometry(3.0, 0.4, 1.42), mat(paint, 0.5, 0.28), [0, -0.02, 0]);

  // Upper body
  addMesh(group, new THREE.BoxGeometry(1.6, 0.68, 1.28), mat(paint, 0.5, 0.28), [-0.2, 0.36, 0]);

  // Roof (slightly sloped toward rear)
  addMesh(group, new THREE.BoxGeometry(1.52, 0.08, 1.24), mat(paint, 0.45, 0.3), [-0.2, 0.7, 0]);

  // Windshield
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 1.18), glassMat());
  ws.position.set(0.7, 0.34, 0);
  ws.rotation.set(0, 0, -0.45);
  group.add(ws);

  // Rear hatch glass
  const rg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 1.18), glassMat(0x6aa0d4, 0.5));
  rg.position.set(-0.95, 0.4, 0);
  rg.rotation.set(0, 0, 0.5);
  group.add(rg);

  // Side windows
  addMesh(group, new THREE.BoxGeometry(0.56, 0.27, 0.04), glassMat(0x6aa0d4, 0.5), [0.18, 0.42, 0.65]);
  addMesh(group, new THREE.BoxGeometry(0.42, 0.25, 0.04), glassMat(0x6aa0d4, 0.5), [-0.5, 0.42, 0.65]);
  addMesh(group, new THREE.BoxGeometry(0.56, 0.27, 0.04), glassMat(0x6aa0d4, 0.5), [0.18, 0.42, -0.65]);
  addMesh(group, new THREE.BoxGeometry(0.42, 0.25, 0.04), glassMat(0x6aa0d4, 0.5), [-0.5, 0.42, -0.65]);

  // Hood
  addMesh(group, new THREE.BoxGeometry(0.94, 0.07, 1.36), mat(paint, 0.55, 0.24), [0.98, 0.2, 0]);

  // Front bumper
  addMesh(group, new THREE.BoxGeometry(0.12, 0.24, 1.42), mat(0x111827, 0.3, 0.65), [1.54, -0.06, 0]);
  addMesh(group, new THREE.BoxGeometry(0.13, 0.06, 1.34), mat(chrome, 0.85, 0.12), [1.55, 0.04, 0]);

  // Rear bumper
  addMesh(group, new THREE.BoxGeometry(0.11, 0.22, 1.42), mat(0x111827, 0.3, 0.65), [-1.52, -0.06, 0]);

  addHeadlight(group, 1.52, 0.1, 0.5);
  addHeadlight(group, 1.52, 0.1, -0.5);
  addHeadlight(group, -1.5, 0.1, 0.48, true);
  addHeadlight(group, -1.5, 0.1, -0.48, true);

  addGrille(group, 1.52, -0.04, 0, 0.72, 0.14);

  addMirror(group, 0.66, 0.38, 0.74);
  addMirror(group, 0.66, 0.38, -0.74);

  // Door handles
  addMesh(group, new THREE.BoxGeometry(0.2, 0.04, 0.04), mat(chrome, 0.9, 0.1), [0.22, 0.04, 0.72]);
  addMesh(group, new THREE.BoxGeometry(0.2, 0.04, 0.04), mat(chrome, 0.9, 0.1), [0.22, 0.04, -0.72]);
  addMesh(group, new THREE.BoxGeometry(0.2, 0.04, 0.04), mat(chrome, 0.9, 0.1), [-0.46, 0.04, 0.72]);
  addMesh(group, new THREE.BoxGeometry(0.2, 0.04, 0.04), mat(chrome, 0.9, 0.1), [-0.46, 0.04, -0.72]);

  addDetailedWheel(group, -0.72, 0.65, 0.33);
  addDetailedWheel(group, -0.72, -0.65, 0.33);
  addDetailedWheel(group, 0.92, 0.65, 0.33);
  addDetailedWheel(group, 0.92, -0.65, 0.33);
}

function buildSedan(group, paint) {
  const trim = 0x0e2a52;
  const chrome = 0xd4dde6;

  // Lower body
  addMesh(group, new THREE.BoxGeometry(3.5, 0.38, 1.48), mat(paint, 0.5, 0.28), [0, -0.02, 0]);

  // Upper cabin
  addMesh(group, new THREE.BoxGeometry(1.7, 0.58, 1.34), mat(paint, 0.5, 0.28), [-0.1, 0.32, 0]);

  // Roof
  addMesh(group, new THREE.BoxGeometry(1.62, 0.08, 1.3), mat(paint, 0.45, 0.3), [-0.1, 0.62, 0]);

  // Windshield
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 1.24), glassMat());
  ws.position.set(0.78, 0.28, 0);
  ws.rotation.set(0, 0, -0.4);
  group.add(ws);

  // Rear window (sloped)
  const rg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.46, 1.24), glassMat(0x6aa0d4, 0.5));
  rg.position.set(-0.92, 0.3, 0);
  rg.rotation.set(0, 0, 0.4);
  group.add(rg);

  // Side windows
  addMesh(group, new THREE.BoxGeometry(0.58, 0.27, 0.04), glassMat(0x6aa0d4, 0.5), [0.24, 0.38, 0.68]);
  addMesh(group, new THREE.BoxGeometry(0.46, 0.26, 0.04), glassMat(0x6aa0d4, 0.5), [-0.42, 0.38, 0.68]);
  addMesh(group, new THREE.BoxGeometry(0.58, 0.27, 0.04), glassMat(0x6aa0d4, 0.5), [0.24, 0.38, -0.68]);
  addMesh(group, new THREE.BoxGeometry(0.46, 0.26, 0.04), glassMat(0x6aa0d4, 0.5), [-0.42, 0.38, -0.68]);

  // Hood
  addMesh(group, new THREE.BoxGeometry(1.08, 0.07, 1.42), mat(paint, 0.55, 0.24), [1.04, 0.19, 0]);

  // Trunk
  addMesh(group, new THREE.BoxGeometry(0.62, 0.22, 1.42), mat(paint, 0.5, 0.28), [-1.2, 0.12, 0]);

  // Front bumper
  addMesh(group, new THREE.BoxGeometry(0.12, 0.22, 1.48), mat(0x111827, 0.3, 0.65), [1.68, -0.06, 0]);
  addMesh(group, new THREE.BoxGeometry(0.13, 0.055, 1.4), mat(chrome, 0.85, 0.12), [1.69, 0.03, 0]);

  // Rear bumper
  addMesh(group, new THREE.BoxGeometry(0.11, 0.2, 1.48), mat(0x111827, 0.3, 0.65), [-1.66, -0.06, 0]);
  addMesh(group, new THREE.BoxGeometry(0.12, 0.05, 1.4), mat(chrome, 0.85, 0.12), [-1.67, 0.0, 0]);

  addHeadlight(group, 1.66, 0.1, 0.52);
  addHeadlight(group, 1.66, 0.1, -0.52);
  addHeadlight(group, -1.64, 0.1, 0.5, true);
  addHeadlight(group, -1.64, 0.1, -0.5, true);

  addGrille(group, 1.66, -0.04, 0, 0.82, 0.14);

  addMirror(group, 0.74, 0.4, 0.78);
  addMirror(group, 0.74, 0.4, -0.78);

  // Door handles
  for (let sx of [0.28, -0.38]) {
    addMesh(group, new THREE.BoxGeometry(0.22, 0.04, 0.04), mat(chrome, 0.9, 0.1), [sx, 0.05, 0.75]);
    addMesh(group, new THREE.BoxGeometry(0.22, 0.04, 0.04), mat(chrome, 0.9, 0.1), [sx, 0.05, -0.75]);
  }

  addDetailedWheel(group, -0.82, 0.7, 0.35);
  addDetailedWheel(group, -0.82, -0.7, 0.35);
  addDetailedWheel(group, 1.02, 0.7, 0.35);
  addDetailedWheel(group, 1.02, -0.7, 0.35);
}

function buildTruck(group, paint) {
  const trim = 0x0e2a52;
  const chrome = 0xd4dde6;

  // Chassis / frame
  addMesh(group, new THREE.BoxGeometry(4.6, 0.16, 0.22), mat(0x1a1a2e, 0.6, 0.5), [0.2, -0.28, 0.62]);
  addMesh(group, new THREE.BoxGeometry(4.6, 0.16, 0.22), mat(0x1a1a2e, 0.6, 0.5), [0.2, -0.28, -0.62]);
  addMesh(group, new THREE.BoxGeometry(0.18, 0.14, 1.36), mat(0x1a1a2e, 0.6, 0.5), [2.4, -0.28, 0]);
  addMesh(group, new THREE.BoxGeometry(0.18, 0.14, 1.36), mat(0x1a1a2e, 0.6, 0.5), [-2.0, -0.28, 0]);

  // Cab body
  addMesh(group, new THREE.BoxGeometry(1.52, 1.18, 1.72), mat(paint, 0.5, 0.28), [-1.36, 0.28, 0]);

  // Cab roof
  addMesh(group, new THREE.BoxGeometry(1.46, 0.1, 1.68), mat(paint, 0.45, 0.3), [-1.36, 0.88, 0]);

  // Windshield
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.65, 1.52), glassMat());
  ws.position.set(-0.62, 0.52, 0);
  ws.rotation.set(0, 0, -0.25);
  group.add(ws);

  // Rear cab window
  addMesh(group, new THREE.BoxGeometry(0.04, 0.36, 1.42), glassMat(0x6aa0d4, 0.5), [-2.1, 0.6, 0]);

  // Side windows
  addMesh(group, new THREE.BoxGeometry(0.72, 0.38, 0.04), glassMat(0x6aa0d4, 0.5), [-1.36, 0.6, 0.87]);
  addMesh(group, new THREE.BoxGeometry(0.72, 0.38, 0.04), glassMat(0x6aa0d4, 0.5), [-1.36, 0.6, -0.87]);

  // Cargo box
  addMesh(group, new THREE.BoxGeometry(2.48, 0.92, 1.66), mat(0x0e1a2e, 0.3, 0.75), [1.04, 0.2, 0]);
  // Cargo floor
  addMesh(group, new THREE.BoxGeometry(2.38, 0.06, 1.56), mat(0x1a2030, 0.2, 0.85), [1.04, -0.25, 0]);

  // Front grille / nose
  addMesh(group, new THREE.BoxGeometry(0.18, 0.5, 1.7), mat(0x1a1a2e, 0.5, 0.55), [-0.6, 0.08, 0]);
  addGrille(group, -0.58, 0.08, 0, 1.4, 0.28);

  // Front bumper (heavy duty)
  addMesh(group, new THREE.BoxGeometry(0.2, 0.34, 1.72), mat(0x1a1a2e, 0.4, 0.6), [-0.58, -0.14, 0]);
  addMesh(group, new THREE.BoxGeometry(0.22, 0.1, 1.64), mat(chrome, 0.85, 0.12), [-0.59, 0.04, 0]);

  // Rear bumper
  addMesh(group, new THREE.BoxGeometry(0.16, 0.28, 1.66), mat(0x1a1a2e, 0.4, 0.6), [2.26, -0.12, 0]);

  // Exhaust stack
  addMesh(group, new THREE.CylinderGeometry(0.06, 0.06, 0.9, 14), mat(chrome, 0.88, 0.1), [-2.1, 0.92, -0.72]);

  // Air intake / horn
  addMesh(group, new THREE.BoxGeometry(0.12, 0.4, 0.22), mat(0x111827, 0.5, 0.6), [-0.66, 1.02, 0]);

  addHeadlight(group, -0.6, 0.35, 0.72);
  addHeadlight(group, -0.6, 0.35, -0.72);
  addHeadlight(group, 2.24, 0.12, 0.6, true);
  addHeadlight(group, 2.24, 0.12, -0.6, true);

  addMirror(group, -0.66, 0.74, 0.96);
  addMirror(group, -0.66, 0.74, -0.96);

  // Dual rear wheels
  addDetailedWheel(group, 1.82, 0.76, 0.44);
  addDetailedWheel(group, 1.82, 0.98, 0.44);
  addDetailedWheel(group, 1.82, -0.76, 0.44);
  addDetailedWheel(group, 1.82, -0.98, 0.44);
  addDetailedWheel(group, -1.62, 0.78, 0.44);
  addDetailedWheel(group, -1.62, -0.78, 0.44);
}

/* ─── Main render dispatcher ────────────────────────────────────── */

function renderThreeVehicle(category) {
  if (!threeReady || !scene) return;
  scene.remove(vehicleGroup);
  vehicleGroup = new THREE.Group();
  scene.add(vehicleGroup);

  const paintMap = {
    pickup:   0xf0f4f8,   // Pearl white
    suv:      0x4a6278,   // Steel blue-grey
    hatchback: 0xb3261e,  // Racing red
    truck:    0x2a3a4a,   // Dark navy
    sedan:    0xe8eef7,   // Silver-white
  };
  const paint = paintMap[category] || 0xf0f4f8;

  if (category === 'pickup')    buildPickup(vehicleGroup, paint);
  else if (category === 'suv')  buildSuv(vehicleGroup, paint);
  else if (category === 'hatchback') buildHatchback(vehicleGroup, paint);
  else if (category === 'truck') buildTruck(vehicleGroup, paint);
  else                          buildSedan(vehicleGroup, paint);

  // Subtle auto-rotate to a nice 3/4 view angle
  vehicleGroup.rotation.y = -0.45;
}

function renderVehicle(category) {
  currentCategory = category;
  if (threeReady) renderThreeVehicle(category);
  else drawFallbackVehicle();
}

function resizeViewer() {
  const wrap = $('.viewer-wrap');
  if (!wrap) return;
  if (!threeReady || !renderer || !camera) {
    drawFallbackVehicle();
    return;
  }
  const width = wrap.clientWidth || 520;
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
  $('#plateInput').addEventListener('input', (event) => {
    event.target.value = normalizePlate(event.target.value);
  });
  $('#quickPlate').addEventListener('input', (event) => {
    event.target.value = normalizePlate(event.target.value);
  });
  $('#rotateModel').addEventListener('click', () => {
    if (threeReady && vehicleGroup) vehicleGroup.rotation.y += Math.PI * 2;
    simpleRotation += 35;
    drawFallbackVehicle();
  });
  $('#lightModel').addEventListener('click', () => {
    lightMode = (lightMode + 1) % 3;
    if (keyLight) keyLight.intensity = [0.75, 1.2, 1.8][lightMode];
    drawFallbackVehicle();
  });
  $('#resetCamera').addEventListener('click', () => {
    if (threeReady && camera && controls) {
      camera.position.set(4.8, 2.6, 5.8);
      controls.target.set(0, 0.25, 0);
    }
    simpleRotation = 0;
    drawFallbackVehicle();
  });
  window.addEventListener('resize', resizeViewer);
}

bindEvents();
renderPhotoInputs();
renderVehicle('pickup');
updateDashboard();
initThree();
