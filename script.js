/* ═══════════════════════════════════════════════════════════════════════════
   AirGrid Delhi — Dashboard Logic
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── CONSTANTS ───
const DELHI_CENTER = [28.6139, 77.2090];
const DELHI_BOUNDS = { minLat: 28.48, maxLat: 28.88, minLng: 76.90, maxLng: 77.40 };
const GRID_ROWS = 16;
const GRID_COLS = 17;

// Known hotspot areas (elevated AQI) — realistic Delhi industrial/traffic zones
const HOTSPOT_ZONES = [
    { name: 'Anand Vihar',       lat: 28.6468, lng: 77.3160, radius: 0.03, boost: 120 },
    { name: 'Okhla Industrial',  lat: 28.5300, lng: 77.2700, radius: 0.04, boost: 140 },
    { name: 'Narela',            lat: 28.8500, lng: 77.0950, radius: 0.04, boost: 130 },
    { name: 'Bawana',            lat: 28.7900, lng: 77.0500, radius: 0.04, boost: 150 },
    { name: 'Mundka',            lat: 28.6800, lng: 77.0300, radius: 0.03, boost: 110 },
    { name: 'Wazirpur',          lat: 28.6950, lng: 77.1580, radius: 0.02, boost: 100 },
    { name: 'ITO',               lat: 28.6280, lng: 77.2410, radius: 0.02, boost:  80 },
    { name: 'Rohini',            lat: 28.7310, lng: 77.1040, radius: 0.03, boost:  90 },
];

// Realistic ward/area names for Delhi
const WARD_NAMES = [
    'Connaught Place','Karol Bagh','Chandni Chowk','Paharganj','Daryaganj','Sadar Bazar',
    'Civil Lines','Model Town','Pitampura','Rohini Sec-1','Rohini Sec-7','Shalimar Bagh',
    'Ashok Vihar','Patel Nagar','Rajouri Garden','Janakpuri','Dwarka Sec-1','Dwarka Sec-10',
    'Vasant Kunj','Saket','Lajpat Nagar','Defence Colony','Greater Kailash','Nehru Place',
    'Okhla Phase-1','Okhla Phase-3','Kalkaji','Tughlakabad','Badarpur','Faridabad Border',
    'Preet Vihar','Mayur Vihar Ph-1','Pandav Nagar','Shakarpur','Laxmi Nagar','Vivek Vihar',
    'Dilshad Garden','Seelampur','Jaffrabad','Maujpur','Yamuna Vihar','Bhajanpura',
    'Narela Sec-A','Narela Industrial','Alipur','GT Karnal Road','Badli','Wazirpur Ind.',
    'Mundka','Nangloi','Sultanpuri','Mangolpuri','Bawana Ind.','Bawana Sec-5',
    'Mehrauli','Vasant Vihar','Hauz Khas','Safdarjung','Kidwai Nagar','RK Puram',
    'Chanakyapuri','Moti Bagh','Netaji Nagar','Lodhi Colony','Jangpura','Bhogal',
    'Anand Vihar','Kaushambi Border','IP Extension','Patparganj','Mayur Vihar Ph-3',
    'Sarita Vihar','Jasola','Madanpur Khadar','Sukhdev Vihar','Govindpuri',
    'Tilak Nagar','Tagore Garden','Subhash Nagar','Kirti Nagar','Moti Nagar',
    'New Ashok Nagar','Trilokpuri','Kalyanpuri','Kondli','Khichripur',
    'Burari','Mukherjee Nagar','Kamla Nagar','Shakti Nagar','Roop Nagar',
    'Timarpur','Gulabi Bagh','Sarai Rohilla','Kishanganj','Pusa Road',
    'Uttam Nagar','Najafgarh','Chhawla','Kapashera','Bijwasan',
    'Mahipalpur','Rangpuri','Vasant Kunj Sec-D','IGI Airport','Aerocity',
    'Sangam Vihar','Tigri','Dakshinpuri','Ambedkar Nagar','Pushp Vihar'
];

// AQI standard classification
const AQI_SCALE = [
    { max: 50,  label: 'Good',         cssClass: 'good',         color: '#00e400' },
    { max: 100, label: 'Satisfactory', cssClass: 'satisfactory', color: '#92d050' },
    { max: 200, label: 'Moderate',     cssClass: 'moderate',     color: '#ffff00' },
    { max: 300, label: 'Poor',         cssClass: 'poor',         color: '#ff7e00' },
    { max: 400, label: 'Very Poor',    cssClass: 'vpoor',        color: '#ff0000' },
    { max: 999, label: 'Severe',       cssClass: 'severe',       color: '#99004c' },
];

// ─── STATE ───
const state = {
    mode: 'citizen',
    view: 'live-map',
    selectedWardId: null,
    wards: [],
    sensors: [],
};

// ─── UTILITIES ───
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randf = (min, max) => Math.random() * (max - min) + min;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function getAQI(value) {
    for (const s of AQI_SCALE) {
        if (value <= s.max) return s;
    }
    return AQI_SCALE[AQI_SCALE.length - 1];
}

function getAQIColor(value) {
    return getAQI(value).color;
}

function getAQIFillColor(value) {
    const c = getAQIColor(value);
    // Return with lower opacity for polygon fills
    return c;
}

// Distance helper
function dist(lat1, lng1, lat2, lng2) {
    return Math.sqrt((lat1 - lat2) ** 2 + (lng1 - lng2) ** 2);
}

// ═══════════════════════════════════════════════════════════════════════════
//  MOCK DATA GENERATION
// ═══════════════════════════════════════════════════════════════════════════

function generateWards() {
    const latStep = (DELHI_BOUNDS.maxLat - DELHI_BOUNDS.minLat) / GRID_ROWS;
    const lngStep = (DELHI_BOUNDS.maxLng - DELHI_BOUNDS.minLng) / GRID_COLS;
    let id = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const sLat = DELHI_BOUNDS.minLat + r * latStep;
            const sLng = DELHI_BOUNDS.minLng + c * lngStep;
            const centerLat = sLat + latStep / 2;
            const centerLng = sLng + lngStep / 2;

            // Base AQI biased toward 150-300 (realistic Delhi)
            let baseAQI = rand(120, 280);

            // Hotspot boost
            for (const hz of HOTSPOT_ZONES) {
                const d = dist(centerLat, centerLng, hz.lat, hz.lng);
                if (d < hz.radius) {
                    baseAQI += Math.round(hz.boost * (1 - d / hz.radius));
                }
            }

            // Clamp
            baseAQI = clamp(baseAQI, 30, 490);

            // 24h history: morning peak (7-10), afternoon dip, evening peak (18-22)
            const history24h = Array.from({ length: 24 }, (_, h) => {
                let mod = 0;
                if (h >= 6 && h <= 10) mod = rand(20, 50);      // morning rush
                else if (h >= 12 && h <= 15) mod = rand(-40, -10); // afternoon low
                else if (h >= 18 && h <= 22) mod = rand(30, 60); // evening peak
                else mod = rand(-20, 10);
                return clamp(baseAQI + mod + rand(-15, 15), 20, 500);
            });

            // 30-day history
            const history30d = Array.from({ length: 30 }, () =>
                clamp(baseAQI + rand(-60, 60), 20, 500)
            );

            const currentAQI = history24h[new Date().getHours()] || history24h[12];

            const name = WARD_NAMES[id % WARD_NAMES.length] || `Ward ${id + 1}`;

            state.wards.push({
                id: `W-${String(id + 1).padStart(3, '0')}`,
                name,
                row: r, col: c,
                bounds: [[sLat, sLng], [sLat + latStep, sLng + lngStep]],
                center: [centerLat, centerLng],
                aqi: currentAQI,
                history24h,
                history30d,
                pollutants: {
                    pm25: Math.round(currentAQI * randf(0.5, 0.7)),
                    pm10: Math.round(currentAQI * randf(0.7, 0.9)),
                    no2: rand(25, 140),
                    co: rand(10, 80),
                    o3: rand(15, 100),
                },
                sensorCount: rand(0, 4),
                layer: null,      // Leaflet reference
            });
            id++;
        }
    }
}

// Sensor location names
const SENSOR_LOCATIONS = [
    'Connaught Place','Anand Vihar','ITO Crossing','Okhla Phase-2','Dwarka Sec-12',
    'Rohini Sec-3','Patel Nagar Metro','Saket Select City','Nehru Place','Lajpat Nagar',
    'Karol Bagh Market','Pitampura TV Tower','Narela Factory Belt','Bawana Ind. Area',
    'Mundka Bus Depot','Tilak Nagar','Mayur Vihar Ph-2','Chandni Chowk','Civil Lines',
    'Vasant Kunj Mall','Janakpuri C-Block','Seelampur','Dilshad Garden','IGI Terminal-3',
    'Mehrauli Heritage','RK Puram Sec-6','Najafgarh Lake','Sangam Vihar','Burari Crossing',
    'GT Karnal Road NH-1'
];

function generateSensors() {
    const types = ['fixed', 'vehicle', 'drone'];
    for (let i = 0; i < 30; i++) {
        const type = types[i % 3];
        const lat = randf(DELHI_BOUNDS.minLat + 0.04, DELHI_BOUNDS.maxLat - 0.04);
        const lng = randf(DELHI_BOUNDS.minLng + 0.04, DELHI_BOUNDS.maxLng - 0.04);

        state.sensors.push({
            id: `${type === 'fixed' ? 'FS' : type === 'vehicle' ? 'VM' : 'DR'}-${String(i + 1).padStart(2, '0')}`,
            type,
            location: SENSOR_LOCATIONS[i] || `Sector ${i}`,
            lat, lng,
            targetLat: lat + randf(-0.01, 0.01),
            targetLng: lng + randf(-0.01, 0.01),
            speed: type === 'drone' ? 0.0006 : (type === 'vehicle' ? 0.0003 : 0),
            aqi: rand(80, 380),
            battery: type === 'fixed' ? 100 : rand(15, 98),
            signal: rand(55, 99),
            status: Math.random() > 0.1 ? 'online' : 'offline',
            marker: null,
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAP INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

let map, wardLayerGroup, sensorLayerGroup;

function initMap() {
    map = L.map('map', {
        center: DELHI_CENTER,
        zoom: 11,
        zoomControl: false,
        attributionControl: false,
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd',
    }).addTo(map);

    // Zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Ward polygons
    wardLayerGroup = L.featureGroup().addTo(map);
    state.wards.forEach(ward => {
        const color = getAQIFillColor(ward.aqi);
        const poly = L.rectangle(ward.bounds, {
            fillColor: color,
            fillOpacity: 0.35,
            color: '#1a1f29',
            weight: 1,
            smoothFactor: 1,
        });

        poly.on('click', () => {
            selectWard(ward.id);
            map.fitBounds(poly.getBounds(), { padding: [40, 40], maxZoom: 13, animate: true });
        });

        poly.on('mouseover', function () {
            this.setStyle({ weight: 2, color: '#fff', fillOpacity: 0.5 });
            this.bringToFront();
        });

        poly.on('mouseout', function () {
            if (state.selectedWardId !== ward.id) {
                this.setStyle({ weight: 1, color: '#1a1f29', fillOpacity: 0.35 });
            }
        });

        poly.bindTooltip(`<strong style="font-family:'Rajdhani',sans-serif;font-size:13px;">${ward.name}</strong><br><span style="font-family:'Space Mono',monospace;font-size:14px;color:${color};font-weight:700;">AQI ${ward.aqi}</span>`, {
            sticky: true,
            className: 'ward-tooltip',
            direction: 'top',
            offset: [0, -5],
        });

        poly.addTo(wardLayerGroup);
        ward.layer = poly;
    });

    // Sensor markers
    sensorLayerGroup = L.featureGroup().addTo(map);
    state.sensors.forEach(sensor => {
        const size = sensor.type === 'drone' ? 14 : (sensor.type === 'vehicle' ? 12 : 10);
        const cls = `sensor-dot sensor-dot-${sensor.type}`;
        const icon = L.divIcon({
            html: `<div class="${cls}" style="width:${size}px;height:${size}px;"></div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        });
        sensor.marker = L.marker([sensor.lat, sensor.lng], { icon }).addTo(sensorLayerGroup);

        const typeLabel = sensor.type === 'fixed' ? 'Fixed Station' : sensor.type === 'vehicle' ? 'Vehicle Sensor' : 'Drone Unit';
        sensor.marker.bindTooltip(`<strong>${sensor.id}</strong> — ${typeLabel}<br>AQI: <span style="color:${getAQIColor(sensor.aqi)};font-weight:700;">${sensor.aqi}</span>`, {
            direction: 'top',
            offset: [0, -8],
        });
    });
}

// Animate mobile sensors
function animateSensors() {
    state.sensors.forEach(s => {
        if (s.type === 'fixed' || !s.marker) return;

        const dLat = s.targetLat - s.lat;
        const dLng = s.targetLng - s.lng;
        const d = Math.sqrt(dLat * dLat + dLng * dLng);

        if (d < 0.0002) {
            // Pick new target
            s.targetLat = clamp(s.lat + randf(-0.025, 0.025), DELHI_BOUNDS.minLat + 0.02, DELHI_BOUNDS.maxLat - 0.02);
            s.targetLng = clamp(s.lng + randf(-0.025, 0.025), DELHI_BOUNDS.minLng + 0.02, DELHI_BOUNDS.maxLng - 0.02);
        } else {
            const ratio = s.speed / d;
            s.lat += dLat * ratio;
            s.lng += dLng * ratio;
            s.marker.setLatLng([s.lat, s.lng]);
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  UI / NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

function setupUI() {
    // Navigation clicks
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (!view) return;
            // Block official-only views in citizen mode
            if (item.classList.contains('official-only') && state.mode === 'citizen') return;
            navigateTo(view);
        });
    });

    // Mode toggle
    document.getElementById('mode-checkbox').addEventListener('change', (e) => {
        state.mode = e.target.checked ? 'official' : 'citizen';
        applyMode();
    });

    // Analytics dropdown
    const sel = document.getElementById('analytics-ward-select');
    state.wards.forEach((w, i) => {
        if (i >= 80) return; // First 80 for dropdown
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = `${w.id} — ${w.name}`;
        sel.appendChild(opt);
    });
    sel.addEventListener('change', (e) => {
        if (e.target.value) renderAnalytics(e.target.value);
    });
}

function navigateTo(viewId) {
    state.view = viewId;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    if (navItem) navItem.classList.add('active');

    // Switch panels
    document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`view-${viewId}`);
    if (panel) panel.classList.add('active');

    // Map resize
    if ((viewId === 'live-map') && map) {
        setTimeout(() => map.invalidateSize(), 150);
    }

    // Render data for views
    if (viewId === 'sensor-network') renderSensorTable();
    if (viewId === 'analytics') {
        const wardId = state.selectedWardId || state.wards[0].id;
        document.getElementById('analytics-ward-select').value = wardId;
        renderAnalytics(wardId);
        renderTopWards();
    }
}

function applyMode() {
    const app = document.getElementById('app');
    app.classList.remove('mode-citizen', 'mode-official');
    app.classList.add(`mode-${state.mode}`);

    // Toggle right panels
    if (state.mode === 'official') {
        document.getElementById('panel-citizen').classList.add('hidden');
        document.getElementById('panel-official').classList.remove('hidden');
    } else {
        document.getElementById('panel-official').classList.add('hidden');
        document.getElementById('panel-citizen').classList.remove('hidden');
    }

    // If citizen and on an official-only view, redirect to live-map
    if (state.mode === 'citizen' && (state.view === 'sensor-network' || state.view === 'analytics')) {
        navigateTo('live-map');
    }

    // Update description
    document.getElementById('mode-desc').textContent =
        state.mode === 'official' ? 'Full DPCC officer dashboard' : 'Simplified public view';

    // Refresh right panel
    if (state.selectedWardId) updateRightPanel();
}

// ═══════════════════════════════════════════════════════════════════════════
//  WARD SELECTION & RIGHT PANEL
// ═══════════════════════════════════════════════════════════════════════════

function selectWard(wardId) {
    // Deselect previous
    if (state.selectedWardId) {
        const prev = state.wards.find(w => w.id === state.selectedWardId);
        if (prev && prev.layer) {
            prev.layer.setStyle({ weight: 1, color: '#1a1f29', fillOpacity: 0.35 });
        }
    }

    state.selectedWardId = wardId;
    const ward = state.wards.find(w => w.id === wardId);
    if (!ward) return;

    // Highlight
    if (ward.layer) {
        ward.layer.setStyle({ weight: 3, color: '#ffffff', fillOpacity: 0.55 });
        ward.layer.bringToFront();
    }

    updateRightPanel();
}

function updateRightPanel() {
    const ward = state.wards.find(w => w.id === state.selectedWardId);
    if (!ward) return;

    const info = getAQI(ward.aqi);

    // ——— CITIZEN PANEL ———
    document.getElementById('cit-ward-name').textContent = ward.name;
    document.getElementById('cit-aqi-val').textContent = ward.aqi;
    document.getElementById('cit-aqi-cat').textContent = info.label;
    document.getElementById('cit-aqi-cat').style.color = info.color;

    const ring = document.getElementById('cit-aqi-ring');
    ring.style.borderColor = info.color;
    ring.style.boxShadow = `inset 0 0 30px rgba(0,0,0,0.5), 0 0 20px ${info.color}33`;
    document.getElementById('cit-aqi-val').style.color = info.color;

    const advisory = document.getElementById('cit-advisory');
    advisory.style.borderLeftColor = info.color;
    const advText = document.getElementById('cit-advisory-text');
    if (info.cssClass === 'good' || info.cssClass === 'satisfactory') {
        advText.textContent = '✅ Safe to go outside. Enjoy the fresh air.';
    } else if (info.cssClass === 'moderate') {
        advText.textContent = '😷 Sensitive groups should limit outdoor time.';
    } else if (info.cssClass === 'poor') {
        advText.textContent = '⚠ Avoid prolonged outdoor exposure. Wear an N95 mask.';
    } else {
        advText.textContent = '🚨 Stay indoors. Close windows. Use air purifiers.';
    }

    // ——— OFFICIAL PANEL ———
    document.getElementById('off-ward-name').textContent = `${ward.id} — ${ward.name}`;
    const offAqiVal = document.getElementById('off-aqi-val');
    offAqiVal.textContent = ward.aqi;
    offAqiVal.style.color = info.color;

    document.getElementById('off-sensor-cnt').textContent = ward.sensorCount;

    // Spike alert
    const spike = document.getElementById('off-spike-alert');
    if (ward.aqi > 300) {
        spike.classList.remove('hidden');
    } else {
        spike.classList.add('hidden');
    }

    // Pollutant bars
    const maxP = 400;
    function setBar(key, val) {
        const pInfo = getAQI(val);
        document.getElementById(`pb-${key}-val`).textContent = val;
        const fill = document.getElementById(`pb-${key}-fill`);
        fill.style.width = `${Math.min(100, (val / maxP) * 100)}%`;
        fill.style.backgroundColor = pInfo.color;
    }
    setBar('pm25', ward.pollutants.pm25);
    setBar('pm10', ward.pollutants.pm10);
    setBar('no2', ward.pollutants.no2);
    setBar('co', ward.pollutants.co);
    setBar('o3', ward.pollutants.o3);

    // Sparkline
    renderSparkline(ward.history24h);
}

// ═══════════════════════════════════════════════════════════════════════════
//  CHART.JS CHARTS
// ═══════════════════════════════════════════════════════════════════════════

let sparklineChart = null;

function renderSparkline(data) {
    const canvas = document.getElementById('sparklineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (sparklineChart) sparklineChart.destroy();

    sparklineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`),
            datasets: [{
                data,
                borderColor: '#00b4d8',
                backgroundColor: 'rgba(0, 180, 216, 0.08)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHitRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: true, mode: 'index' } },
            scales: {
                x: { display: false },
                y: { display: false },
            },
            interaction: { intersect: false },
        }
    });
}

let trendChart = null;

function renderAnalytics(wardId) {
    const ward = state.wards.find(w => w.id === wardId);
    if (!ward) return;

    // 24h trend chart
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;
    if (trendChart) trendChart.destroy();

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(0, 180, 216, 0.25)');
    gradient.addColorStop(1, 'rgba(0, 180, 216, 0)');

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`),
            datasets: [{
                label: 'AQI',
                data: ward.history24h,
                borderColor: '#00b4d8',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointBackgroundColor: '#00b4d8',
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#161b22',
                    titleColor: '#e6edf3',
                    bodyColor: '#8b949e',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    cornerRadius: 6,
                },
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#6e7681', font: { family: "'Space Mono', monospace", size: 10 }, maxTicksLimit: 12 },
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#6e7681', font: { family: "'Space Mono', monospace", size: 10 } },
                    suggestedMin: 0,
                    suggestedMax: 500,
                },
            },
            interaction: { intersect: false, mode: 'index' },
        }
    });

    // 30-day heatmap
    renderHeatmap(ward);
}

function renderHeatmap(ward) {
    const labelRow = document.getElementById('heatmap-labels');
    const gridRow = document.getElementById('heatmap-grid');
    if (!labelRow || !gridRow) return;

    labelRow.innerHTML = '';
    gridRow.innerHTML = '';

    const today = new Date();

    ward.history30d.forEach((val, i) => {
        // Label
        const d = new Date(today);
        d.setDate(d.getDate() - (29 - i));
        const lbl = document.createElement('div');
        lbl.className = 'heatmap-label';
        lbl.textContent = d.getDate();
        labelRow.appendChild(lbl);

        // Cell
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        cell.style.backgroundColor = getAQIColor(val);
        cell.title = `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: AQI ${val}`;
        gridRow.appendChild(cell);
    });
}

function renderTopWards() {
    const sorted = [...state.wards].sort((a, b) => b.aqi - a.aqi).slice(0, 5);
    const list = document.getElementById('top-wards-list');
    if (!list) return;
    list.innerHTML = '';

    sorted.forEach((w, i) => {
        const info = getAQI(w.aqi);
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="top-ward-name">${i + 1}. ${w.name}</span>
            <span class="top-ward-badge aqi-bg-${info.cssClass}">${w.aqi}</span>
        `;
        list.appendChild(li);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  SENSOR TABLE
// ═══════════════════════════════════════════════════════════════════════════

function renderSensorTable() {
    document.getElementById('stat-fixed').textContent = state.sensors.filter(s => s.type === 'fixed').length;
    document.getElementById('stat-vehicle').textContent = state.sensors.filter(s => s.type === 'vehicle').length;
    document.getElementById('stat-drone').textContent = state.sensors.filter(s => s.type === 'drone').length;
    document.getElementById('stat-online').textContent = state.sensors.filter(s => s.status === 'online').length;

    const tbody = document.getElementById('sensor-table-body');
    tbody.innerHTML = '';

    state.sensors.forEach(s => {
        const info = getAQI(s.aqi);
        const typeIcons = { fixed: 'fa-location-dot', vehicle: 'fa-bus', drone: 'fa-helicopter' };
        const batteryColor = s.battery > 50 ? 'var(--aqi-good)' : s.battery > 20 ? 'var(--aqi-moderate)' : 'var(--aqi-vpoor)';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><i class="fa-solid ${typeIcons[s.type]}" style="color:var(--accent);margin-right:6px;"></i>${s.id}</td>
            <td style="text-transform:capitalize;">${s.type}</td>
            <td>${s.location}</td>
            <td style="font-weight:700;color:${info.color};">${s.aqi}</td>
            <td>
                <span class="battery-bar"><span class="battery-fill" style="width:${s.battery}%;background:${batteryColor};"></span></span>
                ${s.battery}%
            </td>
            <td>${s.signal}%</td>
            <td><span class="status-dot ${s.status}"></span>${s.status === 'online' ? 'Live' : 'Offline'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  LIVE TICKER
// ═══════════════════════════════════════════════════════════════════════════

const TICKER_TEMPLATES = [
    (s) => `<strong>${s.id}</strong> (${s.type}) recorded AQI <span style="color:${getAQIColor(s.aqi)};font-weight:700;">${s.aqi}</span> near ${s.location}`,
    (s) => `Sensor <strong>${s.id}</strong> battery at <span style="color:${s.battery < 30 ? '#ff0000' : '#00e400'};font-weight:700;">${s.battery}%</span> — signal ${s.signal}%`,
    (s) => `${s.type === 'drone' ? 'Drone' : 'Vehicle'} <strong>${s.id}</strong> moving through ${s.location} corridor — AQI <span style="color:${getAQIColor(s.aqi)};font-weight:700;">${s.aqi}</span>`,
];

function updateTicker() {
    const s = state.sensors[rand(0, state.sensors.length - 1)];
    const template = TICKER_TEMPLATES[rand(0, TICKER_TEMPLATES.length - 1)];
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const el = document.getElementById('ticker-text');
    if (el) {
        el.style.opacity = '0';
        setTimeout(() => {
            el.innerHTML = `${time} — ${template(s)}`;
            el.style.opacity = '1';
        }, 200);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
//  TOP BAR UPDATES
// ═══════════════════════════════════════════════════════════════════════════

function updateTopBar() {
    const avg = Math.round(state.wards.reduce((sum, w) => sum + w.aqi, 0) / state.wards.length);
    const info = getAQI(avg);

    const valEl = document.getElementById('city-aqi-value');
    valEl.textContent = avg;
    valEl.style.color = info.color;

    const catEl = document.getElementById('city-aqi-category');
    catEl.textContent = info.label;
    catEl.style.backgroundColor = info.color;
    catEl.style.color = (info.cssClass === 'moderate' || info.cssClass === 'satisfactory' || info.cssClass === 'good') ? '#000' : '#fff';

    document.getElementById('active-sensor-count').textContent = state.sensors.filter(s => s.status === 'online').length;
}

function updateTimestamp() {
    document.getElementById('last-updated').textContent = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

// ═══════════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Generate data
    generateWards();
    generateSensors();

    // Setup map
    initMap();

    // Setup UI navigation & toggle
    setupUI();

    // Update top bar
    updateTopBar();

    // Apply initial mode
    applyMode();

    // Select a ward near center
    const centerWard = state.wards.find(w => w.row === Math.floor(GRID_ROWS / 2) && w.col === Math.floor(GRID_COLS / 2));
    if (centerWard) selectWard(centerWard.id);

    // Start ticker
    updateTicker();
    setInterval(updateTicker, 4000);

    // Animate sensors
    setInterval(animateSensors, 800);

    // Update timestamp periodically
    setInterval(updateTimestamp, 5000);

    // Subtle AQI fluctuation every 30s
    setInterval(() => {
        state.wards.forEach(w => {
            w.aqi = clamp(w.aqi + rand(-5, 5), 20, 500);
            if (w.layer) {
                w.layer.setStyle({ fillColor: getAQIFillColor(w.aqi) });
            }
        });
        updateTopBar();
        if (state.selectedWardId) updateRightPanel();
    }, 30000);
});
