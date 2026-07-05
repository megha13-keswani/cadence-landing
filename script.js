// Cadence — interaction layer

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initThemeToggle();
  buildWaveform();
  initScrollReveal();
  buildTranscriptLines();
  initFaqAccordion();
});

/* Mobile hamburger nav  */
function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.classList.toggle('is-active', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  nav.querySelectorAll('.nav__link').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.classList.remove('is-active');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  const STORAGE_KEY = 'cadence-theme';

  const stored = safeGet(STORAGE_KEY);
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const initial = stored || (prefersLight ? 'light' : 'dark');
  applyTheme(initial);

  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    safeSet(STORAGE_KEY, next);
  });

  function applyTheme(theme) {
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      toggle.setAttribute('aria-pressed', 'true');
      toggle.setAttribute('aria-label', 'Switch to dark mode');
    } else {
      root.removeAttribute('data-theme');
      toggle.setAttribute('aria-pressed', 'false');
      toggle.setAttribute('aria-label', 'Switch to light mode');
    }
  }

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable, skip */ }
  }
}

/* hero waveform  */
function buildWaveform() {
  const container = document.getElementById('waveform');
  if (!container) return;

  const barCount = 48;
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('span');
    const height = 20 + Math.random() * 80;
    bar.style.height = `${height}%`;
    bar.style.animationDelay = `${(i * 0.05).toFixed(2)}s`;
    fragment.appendChild(bar);
  }
  container.appendChild(fragment);
}

function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  items.forEach((el) => observer.observe(el));
}

/* transcript preview lines (meetings/transcription section) */
function buildTranscriptLines() {
  const container = document.getElementById('transcriptLines');
  if (!container) return;

  const lines = [
    { time: '00:04', speaker: 'Ritika',  text: "Let's start with last week's retention numbers." },
    { time: '00:19', speaker: 'Arjun',   text: 'Retention held at 68%, up two points from last sprint.' },
    { time: '00:37', speaker: 'Fatima',  text: "Good — let's ship the onboarding change before Friday." },
    { time: '00:52', speaker: 'Ritika',  text: "I'll send the review link once QA signs off." },
  ];

  const fragment = document.createDocumentFragment();
  lines.forEach((line, i) => {
    const row = document.createElement('div');
    row.className = 'transcript-line';
    row.style.animationDelay = `${i * 0.25}s`;
    row.innerHTML = `
      <span class="transcript-line__time">${line.time}</span>
      <span class="transcript-line__body">
        <span class="transcript-line__speaker">${line.speaker}</span>
        <span class="transcript-line__text">${line.text}</span>
      </span>
    `;
    fragment.appendChild(row);
  });
  container.appendChild(fragment);
}

/* FAQ accordion — only one item open at a time */
function initFaqAccordion() {
  const items = document.querySelectorAll('.faq-item');
  if (!items.length) return;

  items.forEach((item) => {
    const button = item.querySelector('.faq-item__question');
    button.addEventListener('click', () => {
      const isOpen = item.getAttribute('data-open') === 'true';

      items.forEach((other) => other.setAttribute('data-open', 'false'));

      item.setAttribute('data-open', String(!isOpen));
    });
  });
}
