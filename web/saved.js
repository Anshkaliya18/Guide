/* saved.js */
'use strict';

(() => {
  const STORAGE_KEY = 'ee_saved';

  const ICONS = {
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

  function readSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = JSON.parse(raw || '[]');
      return Array.isArray(data) ? data.filter(Boolean) : [];
    } catch (err) {
      console.warn('Failed to read saved places:', err);
      return [];
    }
  }

  function writeSaved(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('Failed to write saved places:', err);
    }
  }

  function getIcon(place) {
    return ICONS[place?.category] || ICONS.Other;
  }

  function getDistance(place) {
    const value =
      typeof place?.distance_km === 'number'
        ? place.distance_km
        : typeof place?.distance === 'number'
          ? place.distance
          : 0;
    return Number.isFinite(value) ? value : 0;
  }

  function updateCount(count) {
    const el = document.getElementById('savedCount');
    if (el) el.textContent = String(count);
  }

  function emptyHTML() {
    return `
      <div class="ee-empty">
        <div class="ee-empty-orb">◎</div>
        <p>
          No places saved yet.<br>
          <strong>Explore</strong> and click “Save” to add them here.
        </p>
      </div>
    `;
  }

  function renderSaved() {
    const container = document.getElementById('savedResults');
    if (!container) return;

    const places = readSaved();
    updateCount(places.length);
    container.innerHTML = '';

    if (!places.length) {
      container.innerHTML = emptyHTML();
      return;
    }

    places.forEach((place, index) => {
      const card = document.createElement('article');
      card.className = 'place-card';
      card.style.animationDelay = `${index * 0.04}s`;

      const name = place?.name || 'Unnamed place';
      const category = place?.category || 'Other';
      const desc = place?.desc || 'OpenStreetMap result';

      card.innerHTML = `
        <div class="place-thumb">${getIcon(place)}</div>
        <div class="place-info">
          <span class="badge" style="margin-bottom:0.35rem">${category}</span>
          <h4>${name}</h4>
          <div class="place-meta">${getDistance(place).toFixed(2)} km away</div>
          <p class="place-desc">${desc}</p>
          <div class="place-actions">
            <button class="btn btn-ghost js-fly">Fly to</button>
            <button class="btn btn-ghost js-remove">Remove</button>
          </div>
        </div>
      `;

      const flyBtn = card.querySelector('.js-fly');
      if (flyBtn) {
        flyBtn.addEventListener('click', () => {
          if (window.globe && typeof window.globe.pointOfView === 'function' && place?.lat != null && place?.lng != null) {
            window.globe.pointOfView(
              { lat: Number(place.lat), lng: Number(place.lng), altitude: 1.6 },
              2000
            );
          }
        });
      }

      const removeBtn = card.querySelector('.js-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          const next = readSaved().filter(item => item && item.id !== place.id);
          writeSaved(next);
          renderSaved();
        });
      }

      container.appendChild(card);
    });
  }

  function init() {
    renderSaved();

    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) renderSaved();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.renderSavedPlaces = renderSaved;
})();
