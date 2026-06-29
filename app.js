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

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 3.4;
  controls.maxDistance = 9;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(4, 6, 5);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3.8, 64),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f4, roughness: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.48;
  ground.receiveShadow = true;
  scene.add(ground);

  vehicleGroup = new THREE.Group();
  scene.add(vehicleGroup);
  resizeViewer();
}

function material(color, metalness = 0.25) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.34 });
}

function addBox(group, size, position, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addWheel(group, x, z, radius = 0.35) {
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.24, 40), material(0x151923, 0.1));
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, -0.34, z);
  wheel.castShadow = true;
  group.add(wheel);

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.54, radius * 0.54, 0.255, 32), material(0xc7d2de, 0.5));
  rim.rotation.z = Math.PI / 2;
  rim.position.copy(wheel.position);
  group.add(rim);
}

function renderThreeVehicle(category) {
  if (!threeReady || !scene) return;
  scene.remove(vehicleGroup);
  vehicleGroup = new THREE.Group();
  scene.add(vehicleGroup);

  const paint = category === 'hatchback' ? 0xb3261e : category === 'suv' ? 0x596579 : 0xf8fafc;
  const trim = 0x0e2a52;

  if (category === 'pickup') {
    addBox(vehicleGroup, [3.6, 0.58, 1.32], [0, 0, 0], paint);
    addBox(vehicleGroup, [1.25, 0.82, 1.1], [-0.35, 0.58, 0], trim);
    addBox(vehicleGroup, [1.25, 0.2, 1.18], [1.05, 0.34, 0], 0xc9a646);
  } else if (category === 'suv') {
    addBox(vehicleGroup, [3.1, 0.72, 1.35], [0, 0.02, 0], paint);
    addBox(vehicleGroup, [1.55, 0.9, 1.12], [-0.15, 0.68, 0], trim);
  } else if (category === 'hatchback') {
    addBox(vehicleGroup, [2.55, 0.56, 1.18], [0, 0, 0], paint);
    addBox(vehicleGroup, [1.08, 0.78, 1.0], [-0.2, 0.58, 0], trim);
  } else {
    addBox(vehicleGroup, [3.0, 0.5, 1.2], [0, 0, 0], paint);
    addBox(vehicleGroup, [1.25, 0.66, 0.98], [-0.1, 0.54, 0], trim);
  }

  const glass = category === 'pickup' ? [-0.35, 0.74, 0] : [-0.1, 0.78, 0];
  addBox(vehicleGroup, [0.9, 0.32, 1.22], glass, 0x7fb2e5).material.transparent = true;

  const wheelX = category === 'hatchback' ? 0.9 : 1.18;
  const wheelZ = category === 'truck' ? 0.74 : 0.67;
  addWheel(vehicleGroup, -wheelX, -wheelZ);
  addWheel(vehicleGroup, wheelX, -wheelZ);
  addWheel(vehicleGroup, -wheelX, wheelZ);
  addWheel(vehicleGroup, wheelX, wheelZ);
  vehicleGroup.rotation.y = -0.35;
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
