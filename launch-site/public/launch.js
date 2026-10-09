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
