// Standalone launch signup. Never loads the app platform, auth or mobile gate.
// The matching capture endpoint will be connected in the database phase.
(() => {
  'use strict';
  const form = document.getElementById('launch-form');
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());
  if (!form) return;
  const input = document.getElementById('email');
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('signup-status');
  let saving = false;
  const bounded = value => String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 80);
  const params = new URLSearchParams(location.search);
  const campaign = {
    source: bounded(params.get('utm_source')) || 'unattributed',
    medium: bounded(params.get('utm_medium')),
    campaign: bounded(params.get('utm_campaign'))
  };
  const show = (text, state) => { status.textContent = text; status.dataset.state = state; };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    saving = true;
    button.disabled = true;
    button.textContent = 'Saving…';
    form.setAttribute('aria-busy', 'true');
    show('', 'pending');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/launch-signup', {
        method: 'POST', credentials: 'omit', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.value.trim().toLowerCase(),
          consent: true, consent_version: 'launch-2026-10-09', ...campaign,
          website: document.getElementById('website').value })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.ok !== true) {
        show(response.status === 429 ? 'Too many attempts. Please try again in a few minutes.'
          : 'We couldn’t save your email. Please try again.', 'error');
        return;
      }
      show('You’re on the list. We’ll email you when Beatfall launches.', 'success');
      form.reset();
    } catch {
      show('We couldn’t save your email. Check your connection and try again.', 'error');
    } finally {
      clearTimeout(timer);
      saving = false;
      button.disabled = false;
      button.textContent = 'Notify me at launch';
      form.removeAttribute('aria-busy');
    }
  });
})();
// Screenshot showcase, independent of launch-list submission.
(() => {
  'use strict';
  const section = document.querySelector('.screenshots');
  const viewer = document.querySelector('.screen-viewer');
  if (!section || !viewer || typeof viewer.showModal !== 'function') return;
  const cards = [...section.querySelectorAll('.screen-card')];
  const controls = section.querySelector('.deck-controls');
  const count = section.querySelector('.deck-count');
  const explore = section.querySelector('.explore-screen');
  const fullImage = viewer.querySelector('img');
  const zoom = viewer.querySelector('.viewer-zoom');
  let current = 0, origin = null, previousFocus = null;
  const show = index => {
    current = (index + cards.length) % cards.length;
    section.dataset.screen = String(current);
    cards.forEach((card, i) => { card.hidden = i !== current; });
    count.textContent = String(current + 1).padStart(2, '0') + ' / ' + String(cards.length).padStart(2, '0');
    explore.setAttribute('aria-label', 'Explore ' + cards[current].querySelector('h2').textContent.toLowerCase());
  };
  section.classList.add('enhanced');
  controls.hidden = false;
  section.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => show(current + Number(button.dataset.step))));
  const deck = section.querySelector('.screen-deck');
  deck.addEventListener('touchstart', event => {
    origin = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
  }, { passive: true });
  deck.addEventListener('touchend', event => {
    if (!origin || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - origin.x, dy = event.changedTouches[0].clientY - origin.y;
    origin = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });
  deck.addEventListener('touchcancel', () => { origin = null; });
  const setZoom = value => {
    viewer.classList.toggle('zoomed', value);
    zoom.setAttribute('aria-pressed', String(value));
    zoom.textContent = value ? 'Fit screen' : 'Zoom in';
  };
  explore.addEventListener('click', () => {
    previousFocus = document.activeElement;
    const image = cards[current].querySelector('img');
    fullImage.src = image.src;
    fullImage.alt = image.alt;
    fullImage.width = image.width; fullImage.height = image.height;
    viewer.querySelector('h2').textContent = cards[current].querySelector('h2').textContent;
    setZoom(false);
    document.body.classList.add('viewing-screen');
    viewer.showModal();
    viewer.querySelector('.viewer-image').scrollTo(0, 0);
  });
  zoom.addEventListener('click', () => setZoom(!viewer.classList.contains('zoomed')));
  viewer.querySelector('.viewer-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => {
    document.body.classList.remove('viewing-screen');
    previousFocus?.focus();
  });
  show(0);
})();

