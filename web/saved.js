/* saved.js - GUIDE motion layer */
'use strict';

(() => {
  const STORAGE_KEY = 'ee_saved';
  const HERO_SELECTOR = '.saved-hero';
  const ROOT_READY_CLASS = 'page-ready';
  const EXIT_CLASS = 'page-exit';

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

  let rafId = 0;
  let scrollTicking = false;
  let pageTransitionBound = false;

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

  function formatCount(count) {
    return count === 1 ? '1 place' : `${count} places`;
  }

  function updateCount(count) {
    const countEl = document.getElementById('savedCount');
    if (!countEl) return;

    const meta = document.getElementById('savedCountMeta');
    if (meta) meta.textContent = formatCount(count);

    const from = Number(countEl.textContent || '0') || 0;
    animateCounter(countEl, from, count, 1200);
  }

  function animateCounter(el, from, to, duration = 1200) {
    const start = performance.now();
    const diff = to - from;

    if (Math.abs(diff) < 1) {
      el.textContent = String(to);
      return;
    }

    cancelAnimationFrame(el._counterRaf || 0);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + diff * eased);
      el.textContent = String(value);
      if (t < 1) {
        el._counterRaf = requestAnimationFrame(tick);
      } else {
        el.textContent = String(to);
      }
    };

    el._counterRaf = requestAnimationFrame(tick);
  }

  function emptyHTML() {
    return `
      <div class="ee-empty reveal visible">
        <div class="ee-empty-orb" style="animation: emptyFloat 3.8s ease-in-out infinite alternate;">◎</div>
        <p>
          <strong>No Hidden Gems Saved Yet</strong><br>
          Start exploring the globe and save a few underrated destinations to build your collection.
        </p>
      </div>
    `;
  }

  function setBodyReady() {
    requestAnimationFrame(() => {
      document.body.classList.add(ROOT_READY_CLASS);
    });
  }

  function splitHeadline() {
    const heading = document.querySelector('.saved-hero h1');
    if (!heading || heading.dataset.split === 'true') return;

    const text = heading.textContent.trim();
    const words = text.split(/\s+/).map((word, index) => {
      const delay = 420 + (index * 95);
      return `<span class="word" style="animation-delay:${delay}ms">${word}&nbsp;</span>`;
    }).join('');
    heading.innerHTML = words;
    heading.dataset.split = 'true';
  }

  function createParticles() {
    const hero = document.querySelector(HERO_SELECTOR);
    const layer = document.querySelector('.saved-particles');
    if (!hero || !layer || layer.dataset.ready === 'true') return;

    const count = window.matchMedia('(max-width: 720px)').matches ? 10 : 22;

    for (let i = 0; i < count; i += 1) {
      const particle = document.createElement('span');
      particle.className = 'saved-particle';
      const size = 1.5 + Math.random() * 3.2;
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const dur = 8 + Math.random() * 8;
      const delay = -Math.random() * dur;
      const drift = `${(Math.random() * 120 - 60).toFixed(0)}px`;
      const rise = `${(50 + Math.random() * 90).toFixed(0)}px`;

      particle.style.setProperty('--x', `${left}%`);
      particle.style.setProperty('--y', `${top}%`);
      particle.style.setProperty('--size', `${size}px`);
      particle.style.setProperty('--dur', `${dur.toFixed(2)}s`);
      particle.style.setProperty('--delay', `${delay.toFixed(2)}s`);
      particle.style.setProperty('--drift', drift);
      particle.style.setProperty('--rise', rise);
      layer.appendChild(particle);
    }

    layer.dataset.ready = 'true';
  }

  function observeReveals() {
    const revealTargets = [
      ...document.querySelectorAll('.reveal'),
    ];

    if (!revealTargets.length) return;

    if (!('IntersectionObserver' in window)) {
      revealTargets.forEach((el) => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -10% 0px' });

    revealTargets.forEach((el) => observer.observe(el));
  }

  function setupGlassLighting() {
    const glassNodes = document.querySelectorAll('.glass, .hero-panel, .side-card, .side-note, .results-panel, .saved-card');
    glassNodes.forEach((node) => {
      node.addEventListener('pointermove', (event) => {
        const rect = node.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        node.style.setProperty('--mx', `${Math.max(0, Math.min(100, x))}%`);
        node.style.setProperty('--my', `${Math.max(0, Math.min(100, y))}%`);
      });
    });
  }

  function animateSavedCards(cards) {
    cards.forEach((card, index) => {
      card.style.animationDelay = `${140 + index * 100}ms`;
      requestAnimationFrame(() => card.classList.add('is-visible'));
    });
  }

  function showEmptyState(container) {
    container.innerHTML = emptyHTML();
    const empty = container.querySelector('.ee-empty');
    if (empty) {
      empty.classList.add('reveal', 'visible');
    }
  }

  function renderSaved() {
    const container = document.getElementById('savedResults');
    if (!container) return;

    const places = readSaved();
    updateCount(places.length);
    container.innerHTML = '';

    if (!places.length) {
      showEmptyState(container);
      return;
    }

    const fragment = document.createDocumentFragment();
    const cards = [];

    places.forEach((place, index) => {
      const card = document.createElement('article');
      card.className = 'place-card saved-card';
      card.setAttribute('tabindex', '0');
      card.dataset.id = place?.id || '';
      card.style.animationDelay = `${index * 0.08}s`;

      const name = place?.name || 'Unnamed place';
      const category = place?.category || 'Other';
      const desc = place?.desc || 'OpenStreetMap result';
      const icon = getIcon(place);
      const dist = getDistance(place);
      const col = CAT_COLORS[category] || CAT_COLORS.Other;
      const lat = place?.lat != null ? Number(place.lat).toFixed(4) : null;
      const lng = place?.lng != null ? Number(place.lng).toFixed(4) : null;
      const cardNum = String(index + 1).padStart(2, '0');

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
            <button class="sc2-btn sc2-btn-fly js-fly" title="Fly to on globe" aria-label="Fly to on globe">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2l-19 9 7 2 2 7 10-18z"/></svg>
            </button>
            <button class="sc2-btn sc2-btn-maps js-maps" title="Open in Google Maps" aria-label="Open in Google Maps">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            </button>
            <button class="sc2-btn sc2-btn-remove js-remove" title="Remove" aria-label="Remove saved location">
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
        removeBtn.addEventListener('click', () => removeSavedPlace(place, card));
      }

      fragment.appendChild(card);
      cards.push(card);
    });

    container.appendChild(fragment);
    animateSavedCards(cards);
  }

  function removeSavedPlace(place, card) {
    if (!card) return;

    card.classList.add('is-removing');

    const collapse = () => {
      const current = readSaved().filter((item) => item && item.id !== place.id);
      writeSaved(current);
      renderSaved();
    };

    window.setTimeout(collapse, 400);
  }

  function updateHeroParallax() {
    const hero = document.querySelector(HERO_SELECTOR);
    const video = document.querySelector('.saved-video');
    if (!hero || !video) return;

    const rect = hero.getBoundingClientRect();
    const viewportH = window.innerHeight || 1;
    const offset = Math.max(-1, Math.min(1, (rect.top + rect.height * 0.5 - viewportH * 0.5) / (viewportH * 0.5)));

    video.style.transform = `scale(1.06) translate3d(0, ${offset * -12}px, 0)`;
  }

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    rafId = requestAnimationFrame(() => {
      updateHeroParallax();
      scrollTicking = false;
    });
  }

  function bindPageTransitions() {
    if (pageTransitionBound) return;
    pageTransitionBound = true;

    document.addEventListener('click', (event) => {
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      document.body.classList.add(EXIT_CLASS);
      window.setTimeout(() => {
        window.location.href = anchor.href;
      }, 180);
    }, true);
  }

  function bindButtonMicroInteractions() {
    const interactive = document.querySelectorAll('.btn, .nav-links a, .nav-cta, .sc2-btn');
    interactive.forEach((el) => {
      el.addEventListener('pointerdown', () => {
        el.style.transform = 'translateY(0) scale(0.98)';
      });
      el.addEventListener('pointerup', () => {
        el.style.transform = '';
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
      });
    });
  }

  function refreshFromStorageEvent(event) {
    if (event.key === STORAGE_KEY) renderSaved();
  }

  function init() {
    setBodyReady();
    splitHeadline();
    createParticles();
    observeReveals();
    setupGlassLighting();
    bindPageTransitions();
    bindButtonMicroInteractions();
    renderSaved();
    updateHeroParallax();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('storage', refreshFromStorageEvent);
    window.addEventListener('resize', () => {
      createParticles();
      updateHeroParallax();
    }, { passive: true });

    // make sure the hero content is visible even if animations are reduced
    document.querySelectorAll('.hero-copy, .hero-panel, .results-header, .side-card, .side-note').forEach((el) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.classList.add('visible');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.renderSavedPlaces = renderSaved;
})();
