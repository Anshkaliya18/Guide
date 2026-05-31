/* explore.js */
'use strict';

// ── DATA ──────────────────────────────────────────────────────────────
const CATEGORIES = ['Tourism','Historic','Nature','Park','Museum','Market','Viewpoint','Religious'];

const CAT_ICONS = {
  Tourism:'✦', Historic:'⬡', Nature:'🏔', Park:'❋',
  Museum:'▣', Market:'◎', Viewpoint:'◉', Religious:'✧'
};

const PLACES = [
  { id:1, name:'Moonlight Ridge',       category:'Nature',   distance:4.2,  desc:'Cliffside viewpoint with dramatic sunset panoramas over the valley.',          lat:24.612,lng:73.684 },
  { id:2, name:'Old Lantern Quarter',   category:'Historic', distance:7.8,  desc:'Cobblestone alley district with 18th-century preserved architecture.',          lat:24.575,lng:73.745 },
  { id:3, name:'Aurora Heritage Museum',category:'Museum',   distance:3.1,  desc:'Interactive exhibits featuring local folklore, stories and rare artefacts.',     lat:24.598,lng:73.721 },
  { id:4, name:'Twilight Bazaar',       category:'Market',   distance:5.6,  desc:'Atmospheric night market with artisan stalls and authentic street food.',        lat:24.563,lng:73.704 },
  { id:5, name:'Temple of Echoes',      category:'Religious',distance:9.4,  desc:'Ancient sanctuary renowned for its extraordinary acoustic stone dome.',         lat:24.544,lng:73.779 },
  { id:6, name:'Fern Canopy Reserve',   category:'Park',     distance:6.2,  desc:'Old-growth forest with elevated walkways through dense fern canopy.',           lat:24.630,lng:73.660 },
  { id:7, name:'Summit Vista Point',    category:'Viewpoint',distance:11.3, desc:'360° panoramic platform reachable by a short trail through pine woods.',        lat:24.510,lng:73.800 },
  { id:8, name:'Heritage Craft Village',category:'Tourism',  distance:2.8,  desc:'Living museum of traditional craftsmanship with resident artisans at work.',    lat:24.605,lng:73.730 },
];

// ── STATE ──────────────────────────────────────────────────────────────
const selected = new Set(['Nature','Historic','Museum']);
const stats = { found:0, saved:0, trips:0, countries:12 };
let saved = JSON.parse(localStorage.getItem('ee_saved') || '[]');
let currentResults = [];
let globe = null;
let autoRotateTimer = null;
let activeTab = 'nearby';
let currentPlace = null;

// ── DOM ────────────────────────────────────────────────────────────────
const $chips       = document.getElementById('chips');
const $radius      = document.getElementById('radius');
const $radiusVal   = document.getElementById('radiusValue');
const $discoverBtn = document.getElementById('discoverBtn');
const $results     = document.getElementById('results');
const $loading     = document.getElementById('loadingState');
const $empty       = document.getElementById('emptyState');
const $fill        = document.getElementById('progressFill');
const $modal       = document.getElementById('detailModal');
const $mainGlobe   = document.getElementById('mainGlobe');
const $globeCanvas = document.getElementById('globeCanvas');

// ── CHIPS ──────────────────────────────────────────────────────────────
function renderChips() {
  $chips.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const b = document.createElement('button');
    b.className = 'chip' + (selected.has(cat) ? ' active' : '');
    b.textContent = cat;
    b.onclick = () => { selected.has(cat) ? selected.delete(cat) : selected.add(cat); renderChips(); };
    $chips.appendChild(b);
  });
}

// ── STATS ──────────────────────────────────────────────────────────────
function countUp(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = Number(el.textContent) || 0;
  const delta = target - start;
  const frames = 24;
  let f = 0;
  const t = setInterval(() => {
    f++;
    el.textContent = Math.round(start + delta * f / frames);
    if (f >= frames) clearInterval(t);
  }, 16);
}

function updateStats() {
  countUp('statFound',    stats.found);
  countUp('statSaved',    stats.saved);
  countUp('statTrips',    stats.trips);
  countUp('statCountries',stats.countries);
}

// ── RENDER RESULTS ─────────────────────────────────────────────────────
function renderResults(places) {
  $results.innerHTML = '';
  places.forEach((p, i) => {
    const isSaved = saved.find(s => s.id === p.id);
    const card = document.createElement('article');
    card.className = 'place-card';
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `
      <div class="place-thumb">${CAT_ICONS[p.category] || '◎'}</div>
      <div class="place-info">
        <span class="badge" style="margin-bottom:0.35rem">${p.category}</span>
        <h4>${p.name}</h4>
        <div class="place-meta">${p.distance} km away</div>
        <p class="place-desc">${p.desc}</p>
        <div class="place-actions">
          <button class="btn btn-ghost js-view">View</button>
          <button class="btn btn-ghost js-save">${isSaved ? 'Saved ✓' : 'Save'}</button>
        </div>
      </div>
    `;
    if (isSaved) {
      card.querySelector('.js-save').style.color = 'var(--gold)';
    }
    card.querySelector('.js-view').onclick = () => openModal(p);
    card.querySelector('.js-save').onclick = e => savePlace(p, e.currentTarget);
    $results.appendChild(card);
  });
}

// ── SAVE ───────────────────────────────────────────────────────────────
function savePlace(p, btn) {
  if (saved.find(s => s.id === p.id)) { showToast('Already saved.'); return; }
  saved.push(p);
  localStorage.setItem('ee_saved', JSON.stringify(saved));
  stats.saved = saved.length;
  updateStats();
  btn.textContent = 'Saved ✓';
  btn.style.color = 'var(--gold)';
  showToast(`Saved "${p.name}"`);
}

// ── MODAL ──────────────────────────────────────────────────────────────
function openModal(place) {
  currentPlace = place;
  document.getElementById('modalIcon').textContent  = CAT_ICONS[place.category] || '◎';
  document.getElementById('modalTitle').textContent = place.name;
  document.getElementById('modalMeta').textContent  = `${place.category} · ${place.distance} km · ${place.lat.toFixed(3)}°, ${place.lng.toFixed(3)}°`;
  document.getElementById('modalDesc').textContent  = place.desc;
  const saveBtn = document.getElementById('modalSave');
  const alreadySaved = saved.find(s => s.id === place.id);
  saveBtn.textContent = alreadySaved ? 'Saved ✓' : 'Save place';
  saveBtn.style.color = alreadySaved ? 'var(--gold)' : '';
  $modal.classList.add('open');
  pauseRotation(5000);
  if (globe) globe.pointOfView({ lat: place.lat, lng: place.lng, altitude: 1.6 }, 2000);
}

document.getElementById('closeModal').onclick = () => $modal.classList.remove('open');

document.getElementById('modalFly').onclick = () => {
  if (globe && currentPlace) {
    globe.pointOfView({ lat: currentPlace.lat, lng: currentPlace.lng, altitude: 1.2 }, 2000);
    $modal.classList.remove('open');
    showToast('Flying to location…');
  }
};

document.getElementById('modalSave').onclick = () => {
  if (!currentPlace) return;
  const btn = document.getElementById('modalSave');
  savePlace(currentPlace, btn);
};

// ── DISCOVER ───────────────────────────────────────────────────────────
function discover() {
  if (!selected.size) { showToast('Select at least one category.'); return; }
  pauseRotation(6000);
  $loading.classList.remove('hidden');
  $empty.classList.add('hidden');
  $results.innerHTML = '';
  $fill.style.width = '0%';

  let pct = 0;
  const t = setInterval(() => {
    pct = Math.min(100, pct + 4 + Math.random() * 3);
    $fill.style.width = pct + '%';
    if (pct >= 100) {
      clearInterval(t);
      setTimeout(() => {
        $loading.classList.add('hidden');
        const places = PLACES.filter(p => selected.has(p.category));
        currentResults = places;
        if (!places.length) {
          $empty.classList.remove('hidden');
        } else {
          renderResults(places);
          drawGlobeMarkers(places);
          stats.found = places.length;
          stats.trips++;
          updateStats();
        }
      }, 200);
    }
  }, 40);
}

// ── GLOBE ──────────────────────────────────────────────────────────────
const EARTH_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/earth-blue-marble.jpg'
];
const BUMP_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png',
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/earth-topology.png'
];

async function firstOk(urls) {
  for (const u of urls) {
    const ok = await new Promise(res => {
      const i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = () => res(true); i.onerror = () => res(false); i.src = u;
    });
    if (ok) return u;
  }
  return '';
}

function pauseRotation(ms = 4000) {
  if (globe?.controls) globe.controls().autoRotate = false;
  clearTimeout(autoRotateTimer);
  autoRotateTimer = setTimeout(() => {
    if (globe?.controls) globe.controls().autoRotate = true;
  }, ms);
}

function drawGlobeMarkers(places) {
  if (!globe) return;
  const origin = { lat: 24.5854, lng: 73.7125 };

  const points = [
    { ...origin, name:'Your Location', cat:'current', color:'#c9a96e', r:0.55, alt:0.05 },
    ...places.map(p => ({
      lat: p.lat, lng: p.lng,
      name: p.name, cat: p.category,
      color: '#e8e0d0', r:0.22, alt:0.012,
      dist: p.distance + ' km'
    }))
  ];

  globe
    .pointsData(points)
    .pointLat('lat').pointLng('lng').pointColor('color')
    .pointAltitude('alt').pointRadius('r')
    .pointLabel(d =>
      `<div style="background:rgba(10,11,13,0.94);border:1px solid rgba(201,169,110,0.3);border-radius:8px;padding:6px 10px;font-family:'Outfit',sans-serif;font-size:11px;color:#eeeade">
        <b style="color:#c9a96e">${d.name}</b><br>
        <span style="color:#5a5650">${d.cat}${d.dist ? ' · ' + d.dist : ''}</span>
      </div>`
    );

  globe
    .arcsData(places.map(p => ({
      sLat:origin.lat, sLng:origin.lng,
      eLat:p.lat, eLng:p.lng,
      color:['rgba(201,169,110,0.6)','rgba(201,169,110,0.08)']
    })))
    .arcStartLat('sLat').arcStartLng('sLng')
    .arcEndLat('eLat').arcEndLng('eLng')
    .arcColor('color')
    .arcAltitudeAutoScale(0.3)
    .arcDashLength(0.35).arcDashGap(0.2)
    .arcDashAnimateTime(2000)
    .arcStroke(0.45);
}

async function initGlobe() {
  if (typeof Globe !== 'function' || !$globeCanvas || !$mainGlobe) return;
  const [e, b] = await Promise.all([firstOk(EARTH_URLS), firstOk(BUMP_URLS)]);
  const w = Math.max(1, $mainGlobe.offsetWidth || 500);

  globe = Globe({ width: w, height: w })($globeCanvas)
    .globeImageUrl(e).bumpImageUrl(b)
    .atmosphereColor('#c9a96e')
    .atmosphereAltitude(0.18);

  const ctrl = globe.controls();
  ctrl.autoRotate = true;
  ctrl.autoRotateSpeed = 0.35;
  ctrl.enableZoom = true;
  ctrl.enablePan = false;
  ctrl.zoomSpeed = 1.0;
  ctrl.minDistance = 180;
  ctrl.maxDistance = 450;

  globe.onGlobeReady(() => {
    try {
      const r = globe.renderer();
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      globe.pointOfView({ lat: 24.5854, lng: 73.7125, altitude: 2.2 }, 2000);
    } catch(_) {}
  });

  const ro = new ResizeObserver(() => {
    const s = Math.max(1, $mainGlobe.offsetWidth || 500);
    globe.width(s); globe.height(s);
  });
  ro.observe($mainGlobe);
  window.addEventListener('resize', () => {
    const s = Math.max(1, $mainGlobe.offsetWidth || 500);
    globe.width(s); globe.height(s);
  }, { passive: true });
}

// Fix typo in Globe init call
async function initGlobeFixed() {
  if (typeof Globe !== 'function' || !$globeCanvas || !$mainGlobe) return;
  const [e, b] = await Promise.all([firstOk(EARTH_URLS), firstOk(BUMP_URLS)]);
  const w = Math.max(1, $mainGlobe.offsetWidth || 500);

  globe = Globe({ width: w, height: w })($globeCanvas)
    .globeImageUrl(e).bumpImageUrl(b)
    .atmosphereColor('#c9a96e')
    .atmosphereAltitude(0.18);

  const ctrl = globe.controls();
  ctrl.autoRotate = true;
  ctrl.autoRotateSpeed = 0.35;
  ctrl.enableZoom = true;
  ctrl.enablePan = false;
  ctrl.zoomSpeed = 1.0;
  ctrl.minDistance = 180;
  ctrl.maxDistance = 450;

  globe.onGlobeReady(() => {
    try {
      const r = globe.renderer();
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.0;
      globe.pointOfView({ lat: 24.5854, lng: 73.7125, altitude: 2.2 }, 2000);
    } catch(_) {}
  });

  const ro = new ResizeObserver(() => {
    const s = Math.max(1, $mainGlobe.offsetWidth || 500);
    globe.width(s); globe.height(s);
  });
  ro.observe($mainGlobe);
}

// ── TABS ───────────────────────────────────────────────────────────────
document.getElementById('tabNearby').onclick = () => {
  activeTab = 'nearby';
  document.getElementById('tabNearby').classList.add('active');
  document.getElementById('tabSaved').classList.remove('active');
  if (currentResults.length) renderResults(currentResults);
  else { $results.innerHTML = ''; $empty.classList.remove('hidden'); }
};

document.getElementById('tabSaved').onclick = () => {
  activeTab = 'saved';
  document.getElementById('tabSaved').classList.add('active');
  document.getElementById('tabNearby').classList.remove('active');
  $empty.classList.add('hidden');
  if (saved.length) renderResults(saved);
  else {
    $results.innerHTML = '';
    $empty.classList.remove('hidden');
    $empty.querySelector('p').innerHTML = 'No saved places yet.<br><strong>Save places</strong> while exploring.';
  }
};

// ── EVENTS ─────────────────────────────────────────────────────────────
$radius.addEventListener('input', () => { $radiusVal.textContent = $radius.value + ' km'; });
$discoverBtn.addEventListener('click', discover);

document.getElementById('detectMyLocation').onclick = () => {
  document.getElementById('locationInput').value = 'Current location detected';
  showToast('Location detected.');
};

document.getElementById('expandRadius').onclick = () => {
  $radius.value = Math.min(50, Number($radius.value) + 10);
  $radius.dispatchEvent(new Event('input'));
};

// Pause auto-rotate on interaction
$mainGlobe?.addEventListener('pointerdown', () => pauseRotation(8000));
$mainGlobe?.addEventListener('wheel', () => pauseRotation(5000), { passive: true });

// Mobile nav
document.getElementById('mobControls').onclick = () => {
  document.getElementById('sideControls')?.scrollIntoView({ behavior: 'smooth' });
  ['mobControls','mobDiscover','mobResults'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('mobControls').classList.add('active');
};

document.getElementById('mobDiscover').onclick = () => {
  discover();
  ['mobControls','mobDiscover','mobResults'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('mobDiscover').classList.add('active');
};

document.getElementById('mobResults').onclick = () => {
  document.getElementById('sideResults')?.scrollIntoView({ behavior: 'smooth' });
  ['mobControls','mobDiscover','mobResults'].forEach(id => document.getElementById(id).classList.remove('active'));
  document.getElementById('mobResults').classList.add('active');
};

// ── INIT ───────────────────────────────────────────────────────────────
renderChips();
updateStats();
initGlobeFixed();