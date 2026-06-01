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
    const meta = document.getElementById('savedCountMeta');
    if (meta) meta.textContent = count === 1 ? '1 place' : `${count} places`;
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

  const CAT_COLORS = {
    Tourism:  { bg: 'rgba(201,169,110,0.10)', border: 'rgba(201,169,110,0.28)', text: '#c9a96e' },
    Historic: { bg: 'rgba(160,152,136,0.10)', border: 'rgba(160,152,136,0.28)', text: '#a09888' },
    Nature:   { bg: 'rgba(100,160,120,0.10)', border: 'rgba(100,160,120,0.28)', text: '#6fa87a' },
    Park:     { bg: 'rgba(100,160,120,0.10)', border: 'rgba(100,160,120,0.28)', text: '#6fa87a' },
    Museum:   { bg: 'rgba(140,120,190,0.10)', border: 'rgba(140,120,190,0.28)', text: '#9c88c8' },
    Market:   { bg: 'rgba(200,120,80,0.10)',  border: 'rgba(200,120,80,0.28)',  text: '#c87850' },
    Viewpoint:{ bg: 'rgba(80,140,200,0.10)',  border: 'rgba(80,140,200,0.28)',  text: '#5090c8' },
    Religious:{ bg: 'rgba(201,169,110,0.10)', border: 'rgba(201,169,110,0.28)', text: '#c9a96e' },
    Other:    { bg: 'rgba(90,86,80,0.10)',    border: 'rgba(90,86,80,0.28)',    text: '#5a5650' },
  };

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
      card.className = 'place-card saved-card';
      card.style.animationDelay = `${index * 0.06}s`;

      const name     = place?.name     || 'Unnamed place';
      const category = place?.category || 'Other';
      const desc     = place?.desc     || 'OpenStreetMap result';
      const icon     = getIcon(place);
      const dist     = getDistance(place);
      const col      = CAT_COLORS[category] || CAT_COLORS.Other;
      const lat      = place?.lat != null ? Number(place.lat).toFixed(4) : null;
      const lng      = place?.lng != null ? Number(place.lng).toFixed(4) : null;
      const cardNum  = String(index + 1).padStart(2, '0');

      card.innerHTML = `
        <div class="sc2-wrap">
          <div class="sc2-num">${cardNum}</div>
          <div class="sc2-content">
            <div class="sc2-header">
              <div class="sc2-cat" style="--cc:${col.text};--cb:${col.bg};--cbr:${col.border}">
                <span class="sc2-icon">${icon}</span>
                <span>${category}</span>
              </div>
              ${dist > 0 ? `<div class="sc2-dist"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>${dist.toFixed(1)} km</div>` : ''}
            </div>
            <h4 class="sc2-name">${name}</h4>
            <p class="sc2-desc">${desc}</p>
            ${lat && lng ? `
            <div class="sc2-coords">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${lat}°, ${lng}°
            </div>` : ''}
          </div>
          <div class="sc2-actions">
            <button class="sc2-btn sc2-btn-fly js-fly" title="Fly to on globe">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2l-19 9 7 2 2 7 10-18z"/></svg>
            </button>
            <button class="sc2-btn sc2-btn-maps js-maps" title="Open in Google Maps">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </button>
            <button class="sc2-btn sc2-btn-remove js-remove" title="Remove">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        <div class="sc2-bar" style="background:${col.text};opacity:0.18"></div>
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

      const mapsBtn = card.querySelector('.js-maps');
      if (mapsBtn) {
        mapsBtn.addEventListener('click', () => {
          if (place?.lat != null && place?.lng != null) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.lat + ',' + place.lng)}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          }
        });
      }

      const removeBtn = card.querySelector('.js-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          card.style.transform = 'translateX(36px) scale(0.97)';
          card.style.opacity   = '0';
          card.style.transition = 'transform 0.28s cubic-bezier(.4,0,1,1), opacity 0.28s ease';
          setTimeout(() => {
            const next = readSaved().filter(item => item && item.id !== place.id);
            writeSaved(next);
            renderSaved();
          }, 280);
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
