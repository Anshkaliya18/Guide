/* explore.js */
'use strict';

const CATEGORIES = ['Tourism', 'Historic', 'Nature', 'Park', 'Museum', 'Market', 'Viewpoint', 'Religious'];

const CAT_ICONS = {
  Tourism: '✦',
  Historic: '⬡',
  Nature: '🏔',
  Park: '❋',
  Museum: '▣',
  Market: '◎',
  Viewpoint: '◉',
  Religious: '✧',
  Other: '◌',
};

const API_BASE = (location.origin && location.origin !== 'null')
  ? location.origin
  : 'http://127.0.0.1:8000';

const selected = new Set(CATEGORIES);
const stats = { found: 0, saved: 0, trips: 0, countries: 12 };
let saved = JSON.parse(localStorage.getItem('ee_saved') || '[]');
stats.saved = saved.length;
let currentResults = [];
let globe = null;
let autoRotateTimer = null;
let activeTab = 'nearby';
let currentPlace = null;
let currentOrigin = null;

const $chips = document.getElementById('chips');
const $radius = document.getElementById('radius');
const $radiusVal = document.getElementById('radiusValue');
const $discoverBtn = document.getElementById('discoverBtn');
const $results = document.getElementById('results');
const $loading = document.getElementById('loadingState');
const $empty = document.getElementById('emptyState');
const $fill = document.getElementById('progressFill');
const $modal = document.getElementById('detailModal');
const $mainGlobe = document.getElementById('mainGlobe');
const $globeCanvas = document.getElementById('globeCanvas');
const $locationInput = document.getElementById('locationInput');
const $locationSummary = document.getElementById('locationSummary');
const $coordsPanel = document.getElementById('coordsPanel');
const $latInput = document.getElementById('latInput');
const $lngInput = document.getElementById('lngInput');

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function setLocationSummary(text) {
  if ($locationSummary) {
    $locationSummary.textContent = text;
  }
}

function setOrigin(origin, source = 'manual') {
  if (!origin || typeof origin.lat !== 'number' || typeof origin.lng !== 'number') return;
  currentOrigin = {
    label: origin.label || origin.display_name || 'Selected location',
    lat: origin.lat,
    lng: origin.lng,
    source,
  };

  if ($latInput) $latInput.value = String(origin.lat);
  if ($lngInput) $lngInput.value = String(origin.lng);
  if ($locationInput && origin.label) $locationInput.value = origin.label;

  setLocationSummary(`${currentOrigin.label} • ${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}`);
}

function parseCoords(text) {
  if (!text) return null;
  const match = String(text).trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return { lat, lng };
  }
  return null;
}

async function fetchJson(path) {
  const response = await fetch(path, { headers: { Accept: 'application/json' } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function geocodeLocation(query) {
  return fetchJson(apiUrl(`/api/geocode?q=${encodeURIComponent(query)}`));
}

async function reverseGeocode(lat, lng) {
  return fetchJson(apiUrl(`/api/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`));
}

async function searchLocations({ query = '', lat = null, lng = null, radius = 15, categories = [] } = {}) {
  const params = new URLSearchParams();
  if (query) params.set('query', query);
  if (lat !== null && lat !== undefined) params.set('lat', String(lat));
  if (lng !== null && lng !== undefined) params.set('lng', String(lng));
  params.set('radius', String(radius));
  if (categories.length) params.set('categories', categories.join(','));
  params.set('limit', '30');
  return fetchJson(apiUrl(`/api/search?${params.toString()}`));
}

function renderChips() {
  $chips.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const button = document.createElement('button');
    button.className = 'chip' + (selected.has(cat) ? ' active' : '');
    button.textContent = cat;
    button.onclick = () => {
      if (selected.has(cat)) selected.delete(cat);
      else selected.add(cat);
      renderChips();
    };
    $chips.appendChild(button);
  });
}

function countUp(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = Number(el.textContent) || 0;
  const delta = target - start;
  const frames = 24;
  let f = 0;
  const timer = setInterval(() => {
    f += 1;
    el.textContent = Math.round(start + (delta * f) / frames);
    if (f >= frames) clearInterval(timer);
  }, 16);
}

function updateStats() {
  countUp('statFound', stats.found);
  countUp('statSaved', stats.saved);
  countUp('statTrips', stats.trips);
  countUp('statCountries', stats.countries);
}

function placeDistance(p) {
  if (typeof p.distance_km === 'number') return p.distance_km;
  if (typeof p.distance === 'number') return p.distance;
  return 0;
}

function renderResults(places) {
  $results.innerHTML = '';
  if (!places.length) {
    $results.innerHTML = '';
    $empty.classList.remove('hidden');
    return;
  }

  places.forEach((p, i) => {
    const isSaved = saved.find(s => s.id === p.id);
    const card = document.createElement('article');
    card.className = 'place-card';
    card.style.animationDelay = `${i * 0.04}s`;

    card.innerHTML = `
      <div class="place-thumb">${CAT_ICONS[p.category] || '◌'}</div>
      <div class="place-info">
        <span class="badge" style="margin-bottom:0.35rem">${p.category || 'Other'}</span>
        <h4>${p.name || 'Unnamed place'}</h4>
        <div class="place-meta">
          ${placeDistance(p).toFixed ? placeDistance(p).toFixed(2) : placeDistance(p)} km away
          ${p.score ? `<span class="place-dist">Score ${p.score}</span>` : ''}
        </div>
        <p class="place-desc">${p.desc || 'OpenStreetMap result'}</p>
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

function savePlace(p, btn) {
  if (saved.find(s => s.id === p.id)) {
    showToast('Already saved.');
    return;
  }
  saved.push(p);
  localStorage.setItem('ee_saved', JSON.stringify(saved));
  stats.saved = saved.length;
  updateStats();
  if (btn) {
    btn.textContent = 'Saved ✓';
    btn.style.color = 'var(--gold)';
  }
  showToast(`Saved "${p.name}"`);
}

function openModal(place) {
  currentPlace = place;
  document.getElementById('modalIcon').textContent = CAT_ICONS[place.category] || '◌';
  document.getElementById('modalTitle').textContent = place.name || 'Unnamed place';

  const meta = [
    place.category || 'Other',
    `${placeDistance(place).toFixed ? placeDistance(place).toFixed(2) : placeDistance(place)} km`,
    `${Number(place.lat).toFixed(5)}°, ${Number(place.lng).toFixed(5)}°`,
  ].join(' · ');
  document.getElementById('modalMeta').textContent = meta;
  document.getElementById('modalDesc').textContent = place.desc || 'OpenStreetMap result';

  const saveBtn = document.getElementById('modalSave');
  const alreadySaved = saved.find(s => s.id === place.id);
  saveBtn.textContent = alreadySaved ? 'Saved ✓' : 'Save place';
  saveBtn.style.color = alreadySaved ? 'var(--gold)' : '';

  $modal.classList.add('open');
  pauseRotation(5000);
  if (globe) globe.pointOfView({ lat: Number(place.lat), lng: Number(place.lng), altitude: 1.6 }, 1800);
}

function drawGlobeMarkers(origin, places) {
  if (!globe || !origin) return;

  const points = [
    {
      lat: origin.lat,
      lng: origin.lng,
      name: origin.label || 'Selected location',
      cat: 'origin',
      color: '#c9a96e',
      r: 0.55,
      alt: 0.05,
    },
    ...places.map(p => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      name: p.name,
      cat: p.category,
      color: '#e8e0d0',
      r: 0.22,
      alt: 0.012,
      dist: `${placeDistance(p).toFixed ? placeDistance(p).toFixed(2) : placeDistance(p)} km`,
    })),
  ];

  globe
    .pointsData(points)
    .pointLat('lat')
    .pointLng('lng')
    .pointColor('color')
    .pointAltitude('alt')
    .pointRadius('r')
    .pointLabel(d => `
      <div style="background:rgba(10,11,13,0.94);border:1px solid rgba(201,169,110,0.3);border-radius:8px;padding:6px 10px;font-family:'Outfit',sans-serif;font-size:11px;color:#eeeade">
        <b style="color:#c9a96e">${d.name}</b><br>
        <span style="color:#5a5650">${d.cat}${d.dist ? ' · ' + d.dist : ''}</span>
      </div>
    `)
    .arcsData(places.map(p => ({
      sLat: origin.lat,
      sLng: origin.lng,
      eLat: Number(p.lat),
      eLng: Number(p.lng),
      color: ['rgba(201,169,110,0.6)', 'rgba(201,169,110,0.08)'],
    })))
    .arcStartLat('sLat')
    .arcStartLng('sLng')
    .arcEndLat('eLat')
    .arcEndLng('eLng')
    .arcColor('color')
    .arcAltitudeAutoScale(0.3)
    .arcDashLength(0.35)
    .arcDashGap(0.2)
    .arcDashAnimateTime(2000)
    .arcStroke(0.45);
}

function pauseRotation(ms = 4000) {
  if (globe?.controls) globe.controls().autoRotate = false;
  clearTimeout(autoRotateTimer);
  autoRotateTimer = setTimeout(() => {
    if (globe?.controls) globe.controls().autoRotate = true;
  }, ms);
}

const EARTH_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/earth-blue-marble.jpg',
];
const BUMP_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png',
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/earth-topology.png',
];

async function firstOk(urls) {
  for (const url of urls) {
    const ok = await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    if (ok) return url;
  }
  return '';
}

async function initGlobe() {
  if (typeof Globe !== 'function' || !$globeCanvas || !$mainGlobe) return;
  const [earth, bump] = await Promise.all([firstOk(EARTH_URLS), firstOk(BUMP_URLS)]);
  const size = Math.max(1, $mainGlobe.offsetWidth || 500);

  globe = Globe({ width: size, height: size })($globeCanvas)
    .globeImageUrl(earth)
    .bumpImageUrl(bump)
    .atmosphereColor('#c9a96e')
    .atmosphereAltitude(0.18);

  window.globe = globe;

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
      const renderer = globe.renderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
      if (currentOrigin) {
        globe.pointOfView({ lat: currentOrigin.lat, lng: currentOrigin.lng, altitude: 2.2 }, 1200);
      }
    } catch (_) {}
  });

  const ro = new ResizeObserver(() => {
    const s = Math.max(1, $mainGlobe.offsetWidth || 500);
    globe.width(s);
    globe.height(s);
  });
  ro.observe($mainGlobe);
}

async function detectMyLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation is not available in this browser.');
    return;
  }

  showToast('Detecting your location…');
  navigator.geolocation.getCurrentPosition(async position => {
    const { latitude, longitude } = position.coords;
    if ($latInput) $latInput.value = latitude.toFixed(6);
    if ($lngInput) $lngInput.value = longitude.toFixed(6);

    try {
      const data = await reverseGeocode(latitude, longitude);
      setOrigin({
        label: data.label || data.display_name || 'Current location',
        lat: latitude,
        lng: longitude,
      }, 'browser');
      showToast('Location detected.');
    } catch (err) {
      setOrigin({ label: 'Current location', lat: latitude, lng: longitude }, 'browser');
      showToast('Location detected, but city lookup failed.');
    }
  }, error => {
    showToast(error.message || 'Unable to detect your location.');
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 60000,
  });
}

async function useCoordinates() {
  const lat = Number($latInput?.value);
  const lng = Number($lngInput?.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    showToast('Enter valid latitude and longitude.');
    return;
  }

  try {
    const data = await reverseGeocode(lat, lng);
    setOrigin({
      label: data.label || data.display_name || 'Selected coordinates',
      lat,
      lng,
    }, 'coords');
    showToast('Coordinates applied.');
  } catch (err) {
    setOrigin({ label: 'Selected coordinates', lat, lng }, 'coords');
    showToast('Coordinates applied.');
  }
}

async function resolveSearchOrigin() {
  const input = ($locationInput?.value || '').trim();
  const coords = parseCoords(input);

  if (coords) {
    const data = await reverseGeocode(coords.lat, coords.lng).catch(() => null);
    return {
      label: (data && data.label) || input,
      lat: coords.lat,
      lng: coords.lng,
      source: 'coords-input',
    };
  }

  if (input) {
    const geocoded = await geocodeLocation(input);
    return {
      label: geocoded.label || geocoded.display_name || input,
      lat: Number(geocoded.lat),
      lng: Number(geocoded.lng),
      source: 'geocode',
    };
  }

  if ($latInput && $lngInput && $coordsPanel && !$coordsPanel.classList.contains('hidden')) {
    const lat = Number($latInput.value);
    const lng = Number($lngInput.value);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const data = await reverseGeocode(lat, lng).catch(() => null);
      return {
        label: (data && data.label) || 'Selected coordinates',
        lat,
        lng,
        source: 'coords-panel',
      };
    }
  }

  if (currentOrigin) return currentOrigin;
  throw new Error('Enter a city, place, or coordinates first.');
}

async function discover() {
  try {
    const origin = await resolveSearchOrigin();
    setOrigin(origin, origin.source || 'search');

    if (!selected.size) {
      showToast('Select at least one category.');
      return;
    }

    pauseRotation(6000);
    $loading.classList.remove('hidden');
    $empty.classList.add('hidden');
    $results.innerHTML = '';
    $fill.style.width = '0%';

    let pct = 0;
    const progress = setInterval(() => {
      pct = Math.min(100, pct + 4 + Math.random() * 3);
      $fill.style.width = `${pct}%`;
      if (pct >= 100) {
        clearInterval(progress);
      }
    }, 40);

    const data = await searchLocations({
      query: '',
      lat: origin.lat,
      lng: origin.lng,
      radius: Number($radius.value),
      categories: [...selected],
    });

    clearInterval(progress);
    $fill.style.width = '100%';

    currentResults = data.results || [];
    stats.found = currentResults.length;
    stats.trips += 1;
    stats.saved = saved.length;
    updateStats();

    setLocationSummary(`${data.origin?.label || origin.label} • ${Number(origin.lat).toFixed(5)}, ${Number(origin.lng).toFixed(5)}`);

    setTimeout(() => {
      $loading.classList.add('hidden');
      if (!currentResults.length) {
        $results.innerHTML = '';
        $empty.classList.remove('hidden');
        $empty.querySelector('p').innerHTML = 'No live results were found nearby.<br><strong>Try a bigger radius or another city.</strong>';
        return;
      }
      renderResults(currentResults);
      drawGlobeMarkers(data.origin || origin, currentResults);
      if (globe && data.origin) {
        globe.pointOfView({ lat: data.origin.lat, lng: data.origin.lng, altitude: 2.2 }, 1400);
      }
      showToast(`Found ${currentResults.length} live places.`);
    }, 180);
  } catch (err) {
    $loading.classList.add('hidden');
    showToast(err.message || 'Could not fetch live results.');
  }
}

function showSavedTab() {
  activeTab = 'saved';
  document.getElementById('tabSaved').classList.add('active');
  document.getElementById('tabNearby').classList.remove('active');
  $empty.classList.add('hidden');
  if (saved.length) {
    renderResults(saved);
  } else {
    $results.innerHTML = '';
    $empty.classList.remove('hidden');
    $empty.querySelector('p').innerHTML = 'No saved places yet.<br><strong>Save places</strong> while exploring.';
  }
}

document.getElementById('tabNearby').onclick = () => {
  activeTab = 'nearby';
  document.getElementById('tabNearby').classList.add('active');
  document.getElementById('tabSaved').classList.remove('active');
  if (currentResults.length) renderResults(currentResults);
  else {
    $results.innerHTML = '';
    $empty.classList.remove('hidden');
    $empty.querySelector('p').innerHTML = 'Pick a city or coordinates and search live.';
  }
};

document.getElementById('tabSaved').onclick = showSavedTab;

$radius.addEventListener('input', () => {
  $radiusVal.textContent = `${$radius.value} km`;
});

$discoverBtn.addEventListener('click', discover);

const detectBtn = document.getElementById('detectMyLocation');
if (detectBtn) detectBtn.onclick = detectMyLocation;

const toggleCoordsBtn = document.getElementById('toggleCoords');
if (toggleCoordsBtn) {
  toggleCoordsBtn.onclick = () => {
    if ($coordsPanel) $coordsPanel.classList.toggle('hidden');
  };
}

const useCoordsBtn = document.getElementById('useCoords');
if (useCoordsBtn) useCoordsBtn.onclick = useCoordinates;

const modalFly = document.getElementById('modalFly');
if (modalFly) {
  modalFly.onclick = () => {
    if (globe && currentPlace) {
      globe.pointOfView({ lat: Number(currentPlace.lat), lng: Number(currentPlace.lng), altitude: 1.2 }, 1600);
      $modal.classList.remove('open');
      showToast('Flying to location…');
    }
  };
}

const modalSave = document.getElementById('modalSave');
if (modalSave) {
  modalSave.onclick = () => {
    if (!currentPlace) return;
    savePlace(currentPlace, modalSave);
  };
}

const modalMaps = document.getElementById('modalMaps');
if (modalMaps) {
  modalMaps.onclick = () => {
    if (!currentPlace) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentPlace.lat},${currentPlace.lng}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
}

document.getElementById('closeModal').onclick = () => $modal.classList.remove('open');

$mainGlobe?.addEventListener('pointerdown', () => pauseRotation(8000));
$mainGlobe?.addEventListener('wheel', () => pauseRotation(5000), { passive: true });

const mobControls = document.getElementById('mobControls');
const mobDiscover = document.getElementById('mobDiscover');
const mobResults = document.getElementById('mobResults');

if (mobControls) {
  mobControls.onclick = () => {
    document.getElementById('sideControls')?.scrollIntoView({ behavior: 'smooth' });
    [mobControls, mobDiscover, mobResults].forEach(btn => btn && btn.classList.remove('active'));
    mobControls.classList.add('active');
  };
}

if (mobDiscover) {
  mobDiscover.onclick = () => {
    discover();
    [mobControls, mobDiscover, mobResults].forEach(btn => btn && btn.classList.remove('active'));
    mobDiscover.classList.add('active');
  };
}

if (mobResults) {
  mobResults.onclick = () => {
    document.getElementById('sideResults')?.scrollIntoView({ behavior: 'smooth' });
    [mobControls, mobDiscover, mobResults].forEach(btn => btn && btn.classList.remove('active'));
    mobResults.classList.add('active');
  };
}

renderChips();
updateStats();
initGlobe();
