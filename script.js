/* ───────────── Reveal on scroll ───────────── */
const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
  }
}, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
reveals.forEach((el) => io.observe(el));

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

// TODO: replace with the real endpoint (Google Apps Script / Formspree). Until then submissions are only logged.
const RSVP_ENDPOINT = '';

function syncAttending() {
  const v = form.querySelector('input[name=dolazak]:checked')?.value;
  attendingOnly.forEach((el) => el.classList.toggle('is-hidden', v === 'ne'));
}
form.addEventListener('change', syncAttending);
syncAttending();

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());

  if (!data.ime?.trim()) { status.textContent = 'Molimo upišite ime i prezime.'; form.ime.focus(); return; }
  if (!data.dolazak) { status.textContent = 'Molimo označite dolazite li.'; return; }

  status.textContent = 'Šaljemo…';
  try {
    if (RSVP_ENDPOINT) {
      const res = await fetch(RSVP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, poslano: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('bad status');
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
  }
});
