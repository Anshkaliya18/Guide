/* saved.js */
'use strict';

// Load saved places from localStorage and render them similarly to the Explore results page.
const saved = JSON.parse(localStorage.getItem('ee_saved') || '[]');
const $savedResults = document.getElementById('savedResults');

function renderSaved(places) {
  $savedResults.innerHTML = '';
  if (!places.length) {
    $savedResults.innerHTML = '<p class="loading-state">No places saved yet. Explore and click \"Save\" to add them here.</p>';
    return;
  }
  places.forEach((p, i) => {
    const card = document.createElement('article');
    card.className = 'place-card';
    card.style.animationDelay = `${i * 0.04}s`;
    card.innerHTML = `
      <div class="place-thumb">${p.category ? (['Tourism','Historic','Nature','Park','Museum','Market','Viewpoint','Religious'].includes(p.category) ? {
        Tourism:'✦',Historic:'⬡',Nature:'🏔',Park:'❋',Museum:'▣',Market:'◎',Viewpoint:'◉',Religious:'✧'}[p.category] : '◎') : '◎'}</div>
      <div class="place-info">
        <span class="badge" style="margin-bottom:0.35rem">${p.category}</span>
        <h4>${p.name}</h4>
        <div class="place-meta">${p.distance} km away</div>
        <p class="place-desc">${p.desc}</p>
        <div class="place-actions">
          <button class="btn btn-ghost js-fly">Fly to</button>
          <button class="btn btn-ghost js-remove">Remove</button>
        </div>
      </div>`;
    // Fly to location – reuse the globe if present on the page.
    const flyBtn = card.querySelector('.js-fly');
    if (flyBtn && window.globe) {
      flyBtn.onclick = () => globe.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.6 }, 2000);
    }
    // Remove from saved list.
    const remBtn = card.querySelector('.js-remove');
    remBtn.onclick = () => {
      const idx = saved.findIndex(s => s.id === p.id);
      if (idx !== -1) saved.splice(idx, 1);
      localStorage.setItem('ee_saved', JSON.stringify(saved));
      renderSaved(saved);
    };
    $savedResults.appendChild(card);
  });
}

renderSaved(saved);
