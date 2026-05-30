if (typeof window === "undefined" || typeof document === "undefined") {
  console.error("This script is browser-only.");
  if (typeof process !== "undefined" && typeof process.exit === "function") process.exit(0);
}

const categories = ["Tourism", "Historic", "Nature", "Park", "Museum", "Market", "Viewpoint", "Religious"];

const samplePlaces = [
  { name: "Moonlight Ridge", category: "Nature", distance: "4.2 km", desc: "Cliffside viewpoint with dramatic sunset panoramas.", lat: 24.612, lng: 73.684, color: "#10B981" },
  { name: "Old Lantern Quarter", category: "Historic", distance: "7.8 km", desc: "Cobblestone alley district with preserved architecture.", lat: 24.575, lng: 73.745, color: "#F59E0B" },
  { name: "Aurora Heritage Museum", category: "Museum", distance: "3.1 km", desc: "Interactive exhibits featuring local stories and artifacts.", lat: 24.598, lng: 73.721, color: "#3B82F6" },
  { name: "Twilight Bazaar", category: "Market", distance: "5.6 km", desc: "Night market with artisan stalls and street food.", lat: 24.563, lng: 73.704, color: "#8B5CF6" },
  { name: "Temple of Echoes", category: "Religious", distance: "9.4 km", desc: "Ancient sanctuary famous for its acoustic dome.", lat: 24.544, lng: 73.779, color: "#EAB308" }
];

const chipsEl = document.getElementById("chips");
const radius = document.getElementById("radius");
const radiusValue = document.getElementById("radiusValue");
const discoverBtn = document.getElementById("discoverBtn");
const resultsEl = document.getElementById("results");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const progressFill = document.getElementById("progressFill");
const modal = document.getElementById("detailModal");
const mainGlobe = document.getElementById("mainGlobe");
const globeCanvas = document.getElementById("globeCanvas");
const heroGlobeCanvas = document.getElementById("heroGlobeCanvas");

const stats = { found: 0, countries: 12, saved: 0, trips: 0 };
const selected = new Set(["Nature", "Historic", "Museum"]);

let saved = [];
let resumeSpinTimer = null;
let globe = null;
let heroGlobe = null;

function pauseAutoRotation(ms = 5000) {
  if (globe?.controls) globe.controls().autoRotate = false;
  clearTimeout(resumeSpinTimer);
  resumeSpinTimer = setTimeout(() => {
    if (globe?.controls) globe.controls().autoRotate = true;
  }, ms);
}

function renderChips() {
  chipsEl.innerHTML = "";
  categories.forEach((cat) => {
    const chip = document.createElement("button");
    chip.className = `chip ${selected.has(cat) ? "active" : ""}`;
    chip.textContent = cat;
    chip.onclick = () => {
      selected.has(cat) ? selected.delete(cat) : selected.add(cat);
      renderChips();
    };
    chipsEl.appendChild(chip);
  });
}

function setCount(id, target) {
  const el = document.getElementById(id);
  const start = Number(el.textContent) || 0;
  const delta = target - start;
  const frames = 26;
  let f = 0;
  const timer = setInterval(() => {
    f += 1;
    el.textContent = Math.round(start + (delta * f) / frames);
    if (f >= frames) clearInterval(timer);
  }, 18);
}

function updateStats() {
  setCount("statFound", stats.found);
  setCount("statCountries", stats.countries);
  setCount("statSaved", stats.saved);
  setCount("statTrips", stats.trips);
}

function renderResults(places) {
  resultsEl.innerHTML = "";
  places.forEach((p, idx) => {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animation = `rise .35s ease ${idx * 0.06}s both`;
    card.innerHTML = `
      <div class="thumb"></div>
      <div class="meta">
        <h3>${p.name}</h3>
        <p><span class="badge">${p.category}</span> • ${p.distance}</p>
        <p>${p.desc}</p>
        <div class="row">
          <button class="btn btn-soft view">View on Globe</button>
          <button class="btn btn-soft">Open in Maps</button>
          <button class="btn btn-soft save">Save</button>
        </div>
      </div>
    `;
    card.querySelector(".view").onclick = () => openModal(p);
    card.querySelector(".save").onclick = () => {
      if (!saved.find((s) => s.name === p.name)) {
        saved.push(p);
        stats.saved = saved.length;
        updateStats();
      }
    };
    resultsEl.appendChild(card);
  });
}

function drawMarkers(places) {
  if (!globe) return;

  const origin = { lat: 24.5854, lng: 73.7125 };
  const myPin = [{
    ...origin,
    name: "Your Location",
    type: "current",
    size: 0.55,
    color: "#00d4ff",
    dist: ""
  }];

  const placePins = places.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    name: p.name,
    type: p.category,
    size: 0.24,
    color: p.color,
    dist: p.distance
  }));

  globe
    .pointsData([...myPin, ...placePins])
    .pointLat("lat")
    .pointLng("lng")
    .pointColor("color")
    .pointAltitude((d) => (d.type === "current" ? 0.05 : 0.015))
    .pointRadius((d) => (d.type === "current" ? 0.6 : 0.28))
    .pointLabel((d) =>
      `<div style="background:rgba(3,8,20,0.92);border:1px solid #0066ff;border-radius:8px;padding:6px 10px;font-family:monospace;font-size:11px;color:#e0f4ff;max-width:180px">
        <b style="color:#00d4ff">${d.name}</b><br>
        <span style="color:#4a9eff">${d.type}</span> <span style="color:#7c3aed">${d.dist || ""}</span>
      </div>`
    );

  globe
    .arcsData(places.map((p) => ({
      sLat: origin.lat,
      sLng: origin.lng,
      eLat: p.lat,
      eLng: p.lng,
      color: ["rgba(0,102,255,0.7)", "rgba(255,107,53,0.5)"]
    })))
    .arcStartLat("sLat")
    .arcStartLng("sLng")
    .arcEndLat("eLat")
    .arcEndLng("eLng")
    .arcColor("color")
    .arcAltitudeAutoScale(0.35)
    .arcDashLength(0.4)
    .arcDashGap(0.2)
    .arcDashAnimateTime(1800)
    .arcStroke(0.6);
}

function openModal(place) {
  pauseAutoRotation(3600);
  if (globe) globe.pointOfView({ lat: place.lat, lng: place.lng, altitude: 1.5 }, 2200);
  document.getElementById("modalTitle").textContent = place.name;
  document.getElementById("modalMeta").textContent = `${place.category} • ${place.distance} • ${place.lat.toFixed(3)}, ${place.lng.toFixed(3)}`;
  document.getElementById("modalDesc").textContent = place.desc;
  modal.classList.remove("hidden");
}

function discover() {
  pauseAutoRotation(4200);
  loadingState.classList.remove("hidden");
  emptyState.classList.add("hidden");
  resultsEl.innerHTML = "";
  progressFill.style.width = "0%";

  let pct = 0;
  const progress = setInterval(() => {
    pct += 5;
    progressFill.style.width = `${pct}%`;

    if (pct >= 100) {
      clearInterval(progress);
      loadingState.classList.add("hidden");

      const places = samplePlaces.filter((p) => selected.has(p.category));

      if (!places.length) {
        emptyState.classList.remove("hidden");
      } else {
        renderResults(places);
        drawMarkers(places);
        stats.found = places.length;
        stats.trips += 1;
        updateStats();
      }
    }
  }, 40);
}

function initParticles() {
  const c = document.getElementById("particles");
  if (!c) return;

  const ctx = c.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  function resize() {
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
  }

  resize();
  window.addEventListener("resize", resize);

  const stars = Array.from({ length: 140 }, () => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    r: Math.random() * 1.8 + 0.2,
    vx: (Math.random() - 0.5) * 0.13
  }));

  (function frame() {
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(203, 213, 225, 0.7)";

    stars.forEach((s) => {
      s.x += s.vx;
      if (s.x > c.width) s.x = 0;
      if (s.x < 0) s.x = c.width;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(frame);
  })();
}

const EARTH_URLS = [
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg",
  "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/earth-blue-marble.jpg"
];

const BUMP_URLS = [
  "https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png",
  "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/earth-topology.png"
];

const BG_URLS = [
  "https://cdn.jsdelivr.net/npm/three-globe@2.26.5/example/img/night-sky.png",
  "https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/img/night-sky.png"
];

async function firstWorking(urls) {
  for (const u of urls) {
    const ok = await new Promise((res) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => res(true);
      i.onerror = () => res(false);
      i.src = u;
    });
    if (ok) return u;
  }
  return "";
}

function sizeFromElement(el, fallback = 480) {
  if (!el) return { width: fallback, height: fallback };
  const rect = el.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width || el.offsetWidth || fallback));
  const height = Math.max(1, Math.floor(rect.height || el.offsetHeight || fallback));
  return { width, height };
}

function bindResize(globeInstance, el) {
  if (!globeInstance || !el) return () => {};

  const resize = () => {
    const { width, height } = sizeFromElement(el, 480);
    globeInstance.width(width);
    globeInstance.height(height);
  };

  resize();

  const ro = new ResizeObserver(() => resize());
  ro.observe(el);

  window.addEventListener("resize", resize);

  return () => {
    try { ro.disconnect(); } catch (_) {}
    window.removeEventListener("resize", resize);
  };
}

async function initHeroGlobe() {
  if (typeof Globe !== "function" || !heroGlobeCanvas) return;

  const [earthUrl, bumpUrl] = await Promise.all([
    firstWorking(EARTH_URLS),
    firstWorking(BUMP_URLS)
  ]);

  const { width, height } = sizeFromElement(heroGlobeCanvas, 480);

  heroGlobe = Globe({
    width,
    height,
    animateIn: false
  })(heroGlobeCanvas)
    .globeImageUrl(earthUrl)
    .bumpImageUrl(bumpUrl)
    .atmosphereColor("#1a6fff")
    .atmosphereAltitude(0.2);

  const ctrl = heroGlobe.controls();
  ctrl.autoRotate = true;
  ctrl.autoRotateSpeed = 0.8;
  ctrl.enableZoom = false;
  ctrl.enablePan = false;
  ctrl.enableRotate = false;

  heroGlobe.onGlobeReady(() => {
    try {
      const renderer = heroGlobe.renderer();
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      heroGlobe.pointOfView({ lat: 20, lng: 20, altitude: 1.8 }, 0);
    } catch (_) {}
  });

  bindResize(heroGlobe, heroGlobeCanvas);
}

async function initEarthGlobe() {
  if (typeof Globe !== "function" || !globeCanvas || !mainGlobe) return;

  const [earthUrl, bumpUrl] = await Promise.all([
    firstWorking(EARTH_URLS),
    firstWorking(BUMP_URLS)
  ]);

  const { width, height } = sizeFromElement(mainGlobe, 560);

  globe = Globe({
    width,
    height
  })(globeCanvas)
    .globeImageUrl(earthUrl)
    .bumpImageUrl(bumpUrl)
    .atmosphereColor("#1a6fff")
    .atmosphereAltitude(0.24);

  const ctrl = globe.controls();
  ctrl.autoRotate = true;
  ctrl.autoRotateSpeed = 0.5;
  ctrl.enableZoom = true;
  ctrl.enablePan = false;
  ctrl.zoomSpeed = 1.1;
  ctrl.minDistance = 180;
  ctrl.maxDistance = 420;

  globe.onGlobeReady(() => {
    try {
      const renderer = globe.renderer();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      globe.pointOfView({ lat: 24.5854, lng: 73.7125, altitude: 2.0 }, 1800);
    } catch (_) {}
  });

  bindResize(globe, mainGlobe);
}

document.getElementById("startExplore").onclick = () =>
  document.getElementById("appShell").scrollIntoView({ behavior: "smooth" });

document.getElementById("detectLocation").onclick = () =>
  (document.getElementById("locationInput").value = "Current location detected");

document.getElementById("detectMyLocation").onclick = () =>
  (document.getElementById("locationInput").value = "Current location detected");

document.getElementById("expandRadius").onclick = () => {
  radius.value = Math.min(50, Number(radius.value) + 10);
  radius.dispatchEvent(new Event("input"));
};

document.getElementById("closeModal").onclick = () => modal.classList.add("hidden");
document.getElementById("saveFavorite").onclick = () => modal.classList.add("hidden");

document.getElementById("savedTab").onclick = () => {
  if (saved.length) {
    emptyState.classList.add("hidden");
    renderResults(saved);
  }
};

document.getElementById("mobileDiscover").onclick = discover;
document.getElementById("mobileResults").onclick = () =>
  document.querySelector(".right-panel").scrollIntoView({ behavior: "smooth" });

document.getElementById("mobileControls").onclick = () =>
  document.querySelector(".left-panel").scrollIntoView({ behavior: "smooth" });

radius.addEventListener("input", () => (radiusValue.textContent = `${radius.value}km`));
discoverBtn.addEventListener("click", discover);

modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.add("hidden");
});

mainGlobe?.addEventListener("pointerdown", () => pauseAutoRotation(6000));
mainGlobe?.addEventListener("wheel", () => pauseAutoRotation(6000), { passive: true });

renderChips();
updateStats();
initParticles();
initHeroGlobe();
initEarthGlobe();