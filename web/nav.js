/* nav.js — shared navigation behaviour */
(function () {
  const page = window.location.pathname.split('/').pop() || 'index.html';

  // Mark active link
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // Hamburger toggle
  const ham = document.getElementById('navHam');
  const menu = document.getElementById('mobileMenu');
  if (ham && menu) {
    ham.addEventListener('click', () => {
      menu.classList.toggle('open');
      ham.setAttribute('aria-expanded', menu.classList.contains('open'));
    });
    // Close on outside click
    document.addEventListener('click', e => {
      if (!ham.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('open');
      }
    });
  }

  // Scroll-compress nav
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.style.height = window.scrollY > 20 ? '52px' : '60px';
    }, { passive: true });
  }
})();

// Global toast helper
function showToast(msg, dur = 2400) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<span class="toast-dot"></span><span class="toast-msg"></span>';
    document.body.appendChild(t);
  }
  t.querySelector('.toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), dur);
}

// Global modal helpers
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

/* =========================
   PAGE TRANSITIONS
========================= */

function markPageReady() {
  document.body.classList.add('page-ready');
}

window.addEventListener('load', markPageReady);
if (document.readyState === 'complete') {
  markPageReady();
}

document.querySelectorAll('a[href]').forEach(link => {
  const href = link.getAttribute('href');

  if (
    href &&
    !href.startsWith('#') &&
    !href.startsWith('http')
  ) {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.body.classList.add('page-exit');
      document.body.style.pointerEvents = 'none';

      requestAnimationFrame(() => {
        setTimeout(() => {
          window.location.href = href;
        }, 220);
      });
    });
  }
});

/* Reveal animation */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.15
});

document.querySelectorAll('.reveal, .feature-item, .story-card, .place-card').forEach(el => {
  revealObserver.observe(el);
});