/* explore.js */

"use strict";
// Debug: check if Globe library is loaded
console.log('Globe availability check:', typeof Globe);

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

const API_BASE = (location.origin && location.origin !== 'null' && !location.origin.startsWith('file:'))
  ? location.origin
  : 'http://127.0.0.1:8000';
console.info('API base for calls:', API_BASE);

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
  // Disabled location summary display per user request.
  // Intentionally left blank to prevent updating the UI element.
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
  try {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    const text = await response.text().catch(() => '');
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
    if (!response.ok) {
      console.warn('fetchJson non-ok', { path, status: response.status, text, data });
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  } catch (e) {
    console.error('fetchJson error for', path, e);
    throw e;
  }
}

async function geocodeLocation(query) {
  try {
    return await fetchJson(apiUrl(`/api/geocode?q=${encodeURIComponent(query)}`));
  } catch (e) {
    console.warn('geocodeLocation failed for', query, e);
    throw e;
  }
}

async function reverseGeocode(lat, lng) {
  try {
    return await fetchJson(apiUrl(`/api/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`));
  } catch (e) {
    console.warn('reverseGeocode failed for', lat, lng, e);
    throw e;
  }
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

function escapeHTML(str) {
  return String(str).replace(/[&<>"]/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];
  });
}

function renderResults(places) {
  // Helper to safely escape any HTML from OSM data
  const esc = (s) => escapeHTML(s);

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
        <h4>${esc(p.name) || 'Unnamed place'}</h4>
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
  if (!globe || !origin) {
    console.warn('drawGlobeMarkers: globe or origin missing', { globe: !!globe, origin: !!origin });
    return;
  }

  console.log('📍 Drawing markers for origin:', origin);

  // Clear any existing markers/points first
  globe.pointsData([]);
  globe.arcsData([]);

  // Place dot markers only for discovered gems (not origin — origin uses 3D pin)
  const points = places.map(p => ({
    lat: Number(p.lat),
    lng: Number(p.lng),
    name: p.name,
    cat: p.category,
    color: '#e8e0d0',
    r: 0.22,
    alt: 0.012,
    dist: `${placeDistance(p).toFixed ? placeDistance(p).toFixed(2) : placeDistance(p)} km`,
  }));

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

  // Place the red 3D pin at origin
  addRedPinToScene(origin.lat, origin.lng);
}

function pauseRotation(ms = 4000) {
  if (globe?.controls) globe.controls().autoRotate = false;
  clearTimeout(autoRotateTimer);
  autoRotateTimer = setTimeout(() => {
    if (globe?.controls) globe.controls().autoRotate = true;
  }, ms);
}

// ── Texture URL lists ─────────────────────────────────────────────────────────
const EARTH_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg',
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/earth-blue-marble.jpg',
];
const BUMP_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png',
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/earth-topology.png',
];
// Cloud texture: globe.gl official example clouds.png — 4.8 MB RGBA PNG with
// pre-baked alpha channel (white clouds, black = transparent).  Mirrors ordered
// by reliability; first successful load wins.
const CLOUD_URLS = [
  // Primary: official globe.gl example repo (GitHub raw, no CDN rewrite)
  'https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/clouds/clouds.png',
  // Fallbacks via rawgit-style mirrors
  'https://raw.githubusercontent.com/vasturiano/three-globe/master/example/img/earth-clouds.png',
];

// ── Utility: first URL that loads as an <img> ──────────────────────────────
async function firstOk(urls) {
  for (const url of urls) {
    const ok = await new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
    if (ok) return url;
  }
  return '';
}

// Red 3D pin HTML label used for the origin marker
function originPinLabel(name) {
  return `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
      <div style="
        background:rgba(10,11,13,0.92);
        border:1px solid rgba(201,169,110,0.45);
        border-radius:8px;
        padding:5px 10px;
        font-family:'Outfit',sans-serif;
        font-size:11px;
        color:#eeeade;
        white-space:nowrap;
        margin-bottom:4px;
        box-shadow:0 4px 16px rgba(0,0,0,0.4)
      ">
        <b style="color:#c9a96e">📍 ${name}</b>
      </div>
    </div>
  `;
}

// Build a THREE.js red 3D pin mesh and add it to the globe scene
function addRedPinToScene(lat, lng, altitudeKm = 0) {
  if (!globe) return;
  try {
    const scene = globe.scene();

    // Remove any existing pin
    const old = scene.getObjectByName('__origin_pin__');
    if (old) scene.remove(old);

    const group = new THREE.Group();
    group.name = '__origin_pin__';

    // ── Shadow disc on surface (lies flat on globe surface) ──
    const shadowGeo = new THREE.CircleGeometry(1.6, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide
    });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.position.set(0, 0, 0);

    // ── Pin body (tapered cylinder) pointing outward ──
    const bodyGeo = new THREE.CylinderGeometry(0.0, 1.2, 4.5, 16);
    const bodyMat = new THREE.MeshPhongMaterial({
      color: 0xe02020,
      emissive: 0x660000,
      shininess: 120,
      specular: 0xff8888,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 2.25, 0);

    // ── Pin head (sphere) ──
    const headGeo = new THREE.SphereGeometry(1.5, 20, 20);
    const headMat = new THREE.MeshPhongMaterial({
      color: 0xff3333,
      emissive: 0x990000,
      shininess: 180,
      specular: 0xffaaaa,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 5.5, 0);

    // Keep the pin fully red — no white glint marker
    group.add(shadow, body, head);

    // Use globe.gl's coordinate helper so the pin lands on the exact position.
    const coords = (typeof globe.getCoords === 'function')
      ? globe.getCoords(lat, lng, altitudeKm)
      : null;

    if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y) && Number.isFinite(coords.z)) {
      group.position.set(coords.x, coords.y, coords.z);
    } else {
      // Fallback for older builds: manual spherical conversion.
      const GLOBE_RADIUS = (typeof globe.getGlobeRadius === 'function') ? globe.getGlobeRadius() : 100;
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = lng * (Math.PI / 180);
      const r = GLOBE_RADIUS * (1 + (altitudeKm || 0));
      const surfaceX = -(r * Math.sin(phi) * Math.cos(theta));
      const surfaceY =  (r * Math.cos(phi));
      const surfaceZ =  (r * Math.sin(phi) * Math.sin(theta));
      group.position.set(surfaceX, surfaceY, surfaceZ);
    }

    // Create proper rotation: make local +Y axis point outward from globe center
    const outwardDir = new THREE.Vector3(group.position.x, group.position.y, group.position.z).normalize();
    const defaultDir = new THREE.Vector3(0, 1, 0);
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(defaultDir, outwardDir);
    group.quaternion.copy(quat);

    scene.add(group);
    console.log('🔴 Red pin placed at lat:', lat, 'lng:', lng, 'pos:', group.position.toArray());
    window.__originPinGroup__ = group;
  } catch(e) {
    console.warn('3D pin error:', e);
  }
}

// ── Cloud system ──────────────────────────────────────────────────────────────
// Rotation speed in radians per frame (at ~60fps ≈ 10° per real-world minute,
// slightly faster than the globe's own autoRotate so clouds visibly drift).
const CLOUD_ROT_SPEED = 0.00012; // rad/frame
// Altitude above globe surface as a fraction of globe radius (0.4%)
const CLOUD_ALT = 0.004;
// Module-level ref so we can clean up on re-init
let _cloudMesh = null;
let _cloudRAF  = null;

/**
 * attachCloudLayer()
 * Adds a semi-transparent cloud sphere just above the globe surface.
 * Uses globe.getGlobeRadius() so it works regardless of globe.gl version.
 * The texture (RGBA PNG) has transparency pre-baked into the alpha channel —
 * no need for an alphaMap hack.  Loaded inside the TextureLoader callback to
 * ensure colorSpace is set AFTER the texture object exists.
 * Clouds auto-rotate for smooth, continuous animation.
 */
function attachCloudLayer() {
  if (!globe) return;
  try {
    const scene      = globe.scene();
    const globeR     = (typeof globe.getGlobeRadius === 'function')
                        ? globe.getGlobeRadius()
                        : 100; // globe.gl internal default

    // Remove any previous cloud mesh (e.g. on re-init)
    if (_cloudMesh) { scene.remove(_cloudMesh); _cloudMesh = null; }
    if (_cloudRAF)  { cancelAnimationFrame(_cloudRAF); _cloudRAF = null; }

    // Sphere slightly outside the Earth sphere → no z-fighting
    // Use 75 segments: good quality without mobile GPU strain
    const cloudGeo = new THREE.SphereGeometry(
      globeR * (1 + CLOUD_ALT),
      75, 75
    );

    // Load primary cloud texture — properties set inside onLoad callback
    // so they are applied after the texture object is fully constructed
    new THREE.TextureLoader().load(
      CLOUD_URLS[0],
      /* onLoad */ (tex) => {
        // r152 uses SRGBColorSpace; older THREE used sRGBEncoding
        if (THREE.SRGBColorSpace !== undefined) {
          tex.colorSpace = THREE.SRGBColorSpace;
        } else if (tex.encoding !== undefined) {
          tex.encoding = THREE.sRGBEncoding;  // r151 and below
        }

        const cloudMat = new THREE.MeshBasicMaterial({
          map:         tex,
          color:       0xa8ddff,
          transparent: true,
          opacity:     0.90,
          // depthWrite false prevents the cloud sphere from occluding objects
          // that are further from the camera in the depth buffer
          depthWrite:  false,
          // renderOrder > 0 means it renders after the opaque globe mesh,
          // eliminating any residual z-fighting
          side:        THREE.FrontSide,
        });

        _cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        _cloudMesh.name = '__clouds__';
        _cloudMesh.renderOrder = 1;   // draw after opaque globe surface

        scene.add(_cloudMesh);
        console.info('☁️  Cloud layer active — globe radius:', globeR.toFixed(1));

        // Dedicated animation loop — runs independently of globe autoRotate
        // so clouds keep drifting even when autoRotate is paused by user input
        function rotateClouds() {
          _cloudMesh.rotation.y += CLOUD_ROT_SPEED;
          _cloudRAF = requestAnimationFrame(rotateClouds);
        }
        rotateClouds();
      },
      /* onProgress */ undefined,
      /* onError */ (err) => {
        console.warn('☁️  Primary cloud texture failed, trying fallback…', err);
        // Try second URL if first failed
        const fallback = CLOUD_URLS[1];
        if (!fallback) return;
        new THREE.TextureLoader().load(fallback, (tex2) => {
          if (THREE.SRGBColorSpace !== undefined) tex2.colorSpace = THREE.SRGBColorSpace;
          const mat2 = new THREE.MeshBasicMaterial({
            map: tex2,
            color: 0xa8ddff,
            transparent: true,
            opacity: 0.90,
            depthWrite: false,
            side: THREE.FrontSide
          });
          _cloudMesh = new THREE.Mesh(cloudGeo, mat2);
          _cloudMesh.name = '__clouds__';
          _cloudMesh.renderOrder = 1;
          scene.add(_cloudMesh);
          function rotateClouds2() {
            _cloudMesh.rotation.y += CLOUD_ROT_SPEED;
            _cloudRAF = requestAnimationFrame(rotateClouds2);
          }
          rotateClouds2();
          console.info('☁️  Cloud layer active (fallback URL)');
        });
      }
    );
  } catch (e) {
    console.warn('attachCloudLayer error:', e);
  }
}

async function initGlobe() {
  if (typeof Globe !== 'function' || !$globeCanvas || !$mainGlobe) return;

  // Fetch Earth + bump textures in parallel; clouds attach after globe is ready
  const [earth, bump] = await Promise.all([firstOk(EARTH_URLS), firstOk(BUMP_URLS)]);
  const size = Math.max(1, $mainGlobe.offsetWidth || 500);

  globe = Globe({ width: size, height: size })($globeCanvas)
    .globeImageUrl(earth)
    .bumpImageUrl(bump)
    .atmosphereColor('#5fa8ff')
    .atmosphereAltitude(0.18);

  window.globe = globe;

  const ctrl = globe.controls();
  ctrl.autoRotate      = true;
  ctrl.autoRotateSpeed = 0.35;
  ctrl.enableZoom      = true;
  ctrl.enablePan       = false;
  ctrl.zoomSpeed       = 1.0;
  ctrl.minDistance     = 180;
  ctrl.maxDistance     = 450;

  globe.onGlobeReady(() => {
    try {
      const renderer = globe.renderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);

      // Tone-mapping / colour-space (THREE r152+)
      if (THREE.SRGBColorSpace !== undefined) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      }
      renderer.toneMapping         = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      // ── Attach cloud layer ─────────────────────────────────────────────
      attachCloudLayer();

      if (currentOrigin) {
        globe.pointOfView(
          { lat: currentOrigin.lat, lng: currentOrigin.lng, altitude: 2.2 },
          1200
        );
      }
    } catch (e) {
      console.warn('onGlobeReady error:', e);
    }
  });

  // Keep canvas size in sync with container
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
      setLocationSummary('Detecting location…');
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

    // Fly globe to detected location and show the current-position pin immediately
    if (globe) {
      globe.pointOfView({ lat: latitude, lng: longitude, altitude: 2.2 }, 1400);
      addRedPinToScene(latitude, longitude, 0.01);
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

  // If we already have a valid current origin, and the input text either matches its label
  // or is one of the fallback strings set when geolocation lookup fails, reuse it directly.
  if (currentOrigin && (input === currentOrigin.label || input === 'Current location' || input === 'Selected coordinates')) {
    return currentOrigin;
  }

  if (coords) {
    const data = await reverseGeocode(coords.lat, coords.lng).catch(() => null);
    return {
      label: (data && data.label) || input,
      lat: coords.lat,
      lng: coords.lng,
      source: 'coords-input',
    };
  }

  if (input && input !== 'Current location' && input !== 'Selected coordinates') {
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
      // Clear the location summary once results are displayed to avoid a stale card lingering.
      if (window.locationSummary) {
        const $locationSummary = document.getElementById('locationSummary');
        if ($locationSummary) $locationSummary.textContent = '';
      }
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

// explore.js
// Replace your close handlers with this safer version:

const modalFly = document.getElementById('modalFly');
if (modalFly) {
  modalFly.onclick = () => {
    if (globe && currentPlace) {
      globe.pointOfView({ lat: Number(currentPlace.lat), lng: Number(currentPlace.lng), altitude: 1.2 }, 1600);
      closeModal();
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

const closeModalBtn = document.getElementById('closeModal');
if (closeModalBtn) {
  closeModalBtn.onclick = closeModal;
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

function closeModal() {
  if ($modal) $modal.classList.remove('open');
}

// Force the modal closed on page load
closeModal();