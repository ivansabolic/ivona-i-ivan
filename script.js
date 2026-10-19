/* ───────────── Reveal on scroll ───────────── */
const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
  }
}, { threshold: 0.1, rootMargin: '0px 0px -4% 0px' });
reveals.forEach((el) => io.observe(el));
/* Safety net: anything still hidden when the page is scrolled to the very end gets revealed
   (elements glued to the bottom edge can sit inside the observer's margin forever). */
function revealAtEnd() {
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
    reveals.forEach((el) => el.classList.add('is-visible'));
  }
}
window.addEventListener('scroll', revealAtEnd, { passive: true });

/* Hero copy shows immediately (no need to scroll) */
requestAnimationFrame(() => {
  document.querySelectorAll('.hero .reveal').forEach((el) => el.classList.add('is-visible'));
});

/* ───────────── Nav turns solid after the hero ───────────── */
const nav = document.getElementById('nav');
const hero = document.querySelector('.hero');
const heroMedia = document.querySelector('.hero__media');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function onScroll() {
  const y = window.scrollY;
  const h = hero.offsetHeight;
  nav.classList.toggle('is-solid', y > h - 80);
  // gentle parallax + fade of the hero as it scrolls away
  if (!reduceMotion && y < h) {
    const p = y / h;
    heroMedia.style.transform = `translateY(${y * 0.25}px) scale(${1 + p * 0.06})`;
    heroMedia.style.opacity = String(1 - p * 0.6);
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ───────────── Video: make sure it actually plays on iOS ───────────── */
const video = document.querySelector('.hero__video');
if (video) {
  const tryPlay = () => video.play().catch(() => {});
  tryPlay();
  document.addEventListener('touchstart', tryPlay, { once: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tryPlay(); });
}

/* ───────────── RSVP ───────────── */
const form = document.getElementById('rsvpForm');
const status = document.getElementById('rsvpStatus');
const attendingOnly = form.querySelectorAll('[data-if-attending]');

/* ── RSVP backend: Google Apps Script web app bound to the couple's spreadsheet (see rsvp/Code.gs + DEPLOY.md).
   The endpoint URL and token are NOT in this file: they come from config.js (window.RSVP_CONFIG), which is
   git-ignored locally and generated at deploy time by the GitHub Actions workflow from repository secrets.
   RSVP_ENDPOINT: the "Web app" URL from the Apps Script deployment (ends with /exec).
   RSVP_TOKEN:    the same value as the RSVP_TOKEN script property there (a shared secret against drive-by spam).
   RSVP_DEADLINE: after this moment the form is closed and guests are asked to get in touch directly.
   Until RSVP_ENDPOINT is set, submissions are only logged to the console. */
const RSVP_ENDPOINT = (window.RSVP_CONFIG && window.RSVP_CONFIG.endpoint) || '';
const RSVP_TOKEN = (window.RSVP_CONFIG && window.RSVP_CONFIG.token) || '';
const RSVP_DEADLINE = new Date('2027-03-19T23:59:59+01:00');
const RSVP_TIMEOUT_MS = 15000;

/* Companions: 0..8 extra name fields, added on demand */
const guests = document.getElementById('guests');
const addGuest = document.getElementById('addGuest');
const MAX_GUESTS = 8;
function addGuestRow(focus = true) {
  if (guests.children.length >= MAX_GUESTS) return;
  const row = document.createElement('div');
  row.className = 'guest';
  row.innerHTML = '<input type="text" name="pratnja" placeholder="Ime i prezime" autocomplete="off">' +
                  '<button type="button" class="guest__remove" aria-label="Ukloni osobu">×</button>';
  row.querySelector('.guest__remove').addEventListener('click', () => { row.remove(); addGuest.disabled = false; });
  guests.appendChild(row);
  addGuest.disabled = guests.children.length >= MAX_GUESTS;
  if (focus) row.querySelector('input').focus();
}
addGuest.addEventListener('click', () => addGuestRow());

function syncAttending() {
  const v = form.querySelector('input[name=dolazak]:checked')?.value;
  attendingOnly.forEach((el) => el.classList.toggle('is-hidden', v === 'ne'));
}
form.addEventListener('change', syncAttending);
syncAttending();

/* Closed after the deadline: keep the form visible but not submittable */
if (Date.now() > RSVP_DEADLINE.getTime()) {
  form.classList.add('is-closed');
  form.querySelectorAll('input, textarea, button').forEach((el) => { el.disabled = true; });
  status.textContent = 'Rok za potvrdu dolaska je prošao. Molimo javite nam se izravno.';
}

let sending = false;
form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (sending || form.classList.contains('is-closed')) return;
  const fd = new FormData(form);
  const pratnja = fd.getAll('pratnja').map((v) => v.trim()).filter(Boolean);
  fd.delete('pratnja');
  const data = Object.fromEntries(fd.entries());
  data.pratnja = data.dolazak === 'da' ? pratnja : [];
  data.osobe = data.dolazak === 'da' ? 1 + data.pratnja.length : 0;

  if (!data.ime?.trim()) { status.textContent = 'Molimo upišite ime i prezime.'; form.ime.focus(); return; }
  if (!data.dolazak) { status.textContent = 'Molimo označite dolazite li.'; return; }

  status.textContent = 'Šaljemo…';
  sending = true;
  form.querySelector('button[type=submit]').disabled = true;
  try {
    if (RSVP_ENDPOINT) {
      // Apps Script web apps accept cross-origin POSTs only as "simple requests": text/plain body, no custom headers,
      // and the request is answered after a redirect — hence the plain content type and redirect: 'follow'.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), RSVP_TIMEOUT_MS);
      const res = await fetch(RSVP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...data, token: RSVP_TOKEN, izvor: location.hostname, poslano: new Date().toISOString() }),
        redirect: 'follow',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error('bad status ' + res.status);
      const out = await res.json().catch(() => ({ ok: true }));   // an unreadable body still means the request landed
      if (out && out.ok === false) throw new Error(out.error || 'rejected');
    } else {
      console.log('RSVP (endpoint not configured):', data);
      await new Promise((r) => setTimeout(r, 600));
    }
    form.classList.add('is-sent');
    status.textContent = data.dolazak === 'da'
      ? `Hvala, ${data.ime.trim().split(' ')[0]}! Vidimo se 9. travnja.`
      : `Hvala na odgovoru, ${data.ime.trim().split(' ')[0]}. Žao nam je što nećete moći doći.`;
  } catch (err) {
    status.textContent = 'Nešto je pošlo po zlu. Pokušajte ponovno ili nam se javite izravno.';
    form.querySelector('button[type=submit]').disabled = false;
  } finally {
    sending = false;
  }
});

/* ───────────── Doors of Durin: tap / click / keyboard toggle; hover handles pointer devices (CSS) ───────────── */
(() => {
  const doors = document.getElementById('doors');
  if (!doors) return;
  const isOpen = () => doors.classList.contains('is-open');
  const setOpen = (open) => {
    doors.classList.toggle('is-open', open);
    doors.setAttribute('aria-pressed', String(open));
  };
  doors.addEventListener('click', () => setOpen(!isOpen()));
  doors.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!isOpen()); }
  });

  // Touch screens have no hover: open the doors once by themselves when they scroll into view.
  if (window.matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
    const once = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setTimeout(() => { if (!isOpen()) setOpen(true); }, 900);
        once.disconnect();
      }
    }, { threshold: 0.6 });
    once.observe(doors);
  }
})();
