// Cadence — Sprint 2: State Injection, Persistence & Event Architecture

/* ============================================================
   PHASE 3 — Custom PubSub Event Bus
   Decouples app logic (state changes) from UI logic (DOM events).
   Any module can `emit` without knowing who's listening, and any
   module can `on` without knowing who emits.
   ============================================================ */
class EventBus {
  constructor() {
    this.listeners = {};
  }
  on(event, handler) {
    (this.listeners[event] ??= []).push(handler);
    return () => this.off(event, handler); // returns an unsubscribe fn
  }
  off(event, handler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
  }
  emit(event, payload) {
    (this.listeners[event] || []).forEach((handler) => handler(payload));
  }
}
const bus = new EventBus();

// Example subscribers: pure diagnostics, completely decoupled from the DOM.
// Deleting these four lines would not break the toggle, nav, or FAQ — proof
// that the emitting code and the listening code don't know about each other.
bus.on('theme:changed', (theme) => console.log(`[Cadence] theme -> ${theme}`));
bus.on('faq:toggled', (i) => console.log(`[Cadence] faq item ${i === -1 ? 'closed' : i} opened`));
bus.on('nav:toggled', (open) => console.log(`[Cadence] mobile nav ${open ? 'opened' : 'closed'}`));
bus.on('data:loaded', (data) => console.log(`[Cadence] hydrated ${Object.keys(data).length} sections from data.json`));

/* ============================================================
   PHASE 2 — Central App State + localStorage Persistence
   One serialized object, one storage key. The <head> inline script
   reads the same key before first paint to avoid a theme flicker.
   ============================================================ */
const STORAGE_KEY = 'cadence-state';
const defaultState = { theme: null, faqOpenIndex: -1 };

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...defaultState };
  }
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private-browsing / quota-full — app still works in-memory this session */
  }
}
let appState = loadState();
function setState(patch) {
  appState = { ...appState, ...patch };
  saveState(appState);
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initThemeToggle();
  buildWaveform();
  initScrollReveal();
  loadAndRenderData();
});

/* Mobile hamburger nav.
   PHASE 3 memory-leak demo: the outside-click listener is only attached to
   `document` while the menu is open, and explicitly removeEventListener'd
   the moment it closes — it never lingers after the element it protects
   is no longer visible/relevant. */
function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');
  if (!toggle || !nav) return;

  function onOutsideClick(e) {
    if (!nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
  }
  function openNav() {
    nav.classList.add('is-open');
    toggle.classList.add('is-active');
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onOutsideClick);
    bus.emit('nav:toggled', true);
  }
  function closeNav() {
    nav.classList.remove('is-open');
    toggle.classList.remove('is-active');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onOutsideClick); // <- explicit cleanup
    bus.emit('nav:toggled', false);
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    nav.classList.contains('is-open') ? closeNav() : openNav();
  });
  nav.querySelectorAll('.nav__link').forEach((link) => link.addEventListener('click', closeNav));
}

/* Theme toggle — reads/writes the shared appState (Phase 2) instead of its own key */
function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  if (!toggle) return;

  if (!appState.theme) {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    appState.theme = prefersLight ? 'light' : 'dark';
  }
  applyTheme(appState.theme);

  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    applyTheme(next);
    setState({ theme: next });
    bus.emit('theme:changed', next);
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
}

function buildWaveform() {
  const container = document.getElementById('waveform');
  if (!container) return;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 48; i++) {
    const bar = document.createElement('span');
    bar.style.height = `${20 + Math.random() * 80}%`;
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

function registerReveal(el) {
  el.classList.add('reveal');
  if (!('IntersectionObserver' in window)) {
    el.classList.add('is-visible');
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  observer.observe(el);
}

async function loadAndRenderData() {
  try {
    const res = await fetch('data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    renderStats(data.stats);
    renderFeatures(data.features);
    renderTranscriptPoints(data.transcriptPoints);
    renderTranscriptLines(data.transcriptLines);
    renderWorkflow(data.workflow);
    renderIntegrations(data.integrations);
    renderTestimonials(data.testimonials);
    renderPricing(data.pricing);
    renderFaq(data.faq);

    bus.emit('data:loaded', data);
  } catch (err) {
    console.error('[Cadence] Failed to load data.json:', err);
    document.querySelectorAll('[data-empty-for]').forEach((el) => {
      el.textContent = 'Could not load content. Please refresh the page.';
      el.classList.add('empty-state--error');
    });
  }
}

function clearContainer(container) {
  while (container.firstChild) container.removeChild(container.firstChild);
}

function renderStats(stats) {
  const container = document.getElementById('statsGrid');
  if (!container || !stats?.length) return;
  clearContainer(container);
  stats.forEach((stat) => {
    const el = document.createElement('div');
    el.className = 'stat';
    const num = document.createElement('span');
    num.className = 'stat__number';
    num.textContent = stat.number;
    const label = document.createElement('span');
    label.className = 'stat__label';
    label.textContent = stat.label;
    el.append(num, label);
    container.appendChild(el);
    registerReveal(el);
  });
}

function renderFeatures(features) {
  const container = document.getElementById('featuresGrid');
  if (!container || !features?.length) return;
  clearContainer(container);
  features.forEach((f) => {
    const card = document.createElement('article');
    card.className = 'feature-card';
    const time = document.createElement('span');
    time.className = 'feature-card__time';
    time.textContent = f.time;
    const title = document.createElement('h3');
    title.className = 'feature-card__title';
    title.textContent = f.title;
    const text = document.createElement('p');
    text.className = 'feature-card__text';
    text.textContent = f.text;
    card.append(time, title, text);
    container.appendChild(card);
    registerReveal(card);
  });
}

function renderTranscriptPoints(points) {
  const container = document.getElementById('transcriptPoints');
  if (!container || !points?.length) return;
  clearContainer(container);
  points.forEach((point) => {
    const li = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'transcripts__point-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '◆';
    li.append(icon, document.createTextNode(' ' + point));
    container.appendChild(li);
    registerReveal(li);
  });
}

function renderTranscriptLines(lines) {
  const container = document.getElementById('transcriptLines');
  if (!container || !lines?.length) return;
  clearContainer(container);
  lines.forEach((line, i) => {
    const row = document.createElement('div');
    row.className = 'transcript-line';
    row.style.animationDelay = `${i * 0.25}s`;

    const time = document.createElement('span');
    time.className = 'transcript-line__time';
    time.textContent = line.time;

    const body = document.createElement('span');
    body.className = 'transcript-line__body';
    const speaker = document.createElement('span');
    speaker.className = 'transcript-line__speaker';
    speaker.textContent = line.speaker;
    const text = document.createElement('span');
    text.className = 'transcript-line__text';
    text.textContent = line.text;
    body.append(speaker, text);

    row.append(time, body);
    container.appendChild(row);
  });
}

function renderWorkflow(steps) {
  const container = document.getElementById('workflowList');
  if (!container || !steps?.length) return;
  clearContainer(container);
  steps.forEach((s) => {
    const li = document.createElement('li');
    li.className = 'workflow__step';
    const time = document.createElement('span');
    time.className = 'workflow__step-time';
    time.textContent = s.step;
    const p = document.createElement('p');
    p.textContent = s.text;
    li.append(time, p);
    container.appendChild(li);
    registerReveal(li);
  });
}

function renderIntegrations(list) {
  const container = document.getElementById('integrationsList');
  if (!container || !list?.length) return;
  clearContainer(container);
  list.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    container.appendChild(li);
  });
}

function renderTestimonials(testimonials) {
  const container = document.getElementById('testimonialsGrid');
  if (!container || !testimonials?.length) return;
  clearContainer(container);
  testimonials.forEach((t) => {
    const card = document.createElement('blockquote');
    card.className = 'testimonial-card';
    const quote = document.createElement('p');
    quote.className = 'testimonial-card__quote';
    quote.textContent = t.quote;
    const footer = document.createElement('footer');
    footer.className = 'testimonial-card__author';
    const name = document.createElement('span');
    name.className = 'testimonial-card__name';
    name.textContent = t.name;
    const role = document.createElement('span');
    role.className = 'testimonial-card__role';
    role.textContent = t.role;
    footer.append(name, role);
    card.append(quote, footer);
    container.appendChild(card);
    registerReveal(card);
  });
}

function renderPricing(plans) {
  const container = document.getElementById('pricingGrid');
  if (!container || !plans?.length) return;
  clearContainer(container);
  plans.forEach((plan) => {
    const card = document.createElement('article');
    card.className = 'pricing-card' + (plan.popular ? ' pricing-card--popular' : '');

    if (plan.popular) {
      const badge = document.createElement('span');
      badge.className = 'pricing-card__badge';
      badge.textContent = 'Most popular';
      card.appendChild(badge);
    }

    const name = document.createElement('h3');
    name.className = 'pricing-card__name';
    name.textContent = plan.name;

    const price = document.createElement('p');
    price.className = 'pricing-card__price';
    price.textContent = plan.price;
    const suffix = document.createElement('span');
    suffix.textContent = '/month';
    price.appendChild(suffix);

    const desc = document.createElement('p');
    desc.className = 'pricing-card__desc';
    desc.textContent = plan.desc;

    const divider = document.createElement('div');
    divider.className = 'pricing-card__divider';

    const featureList = document.createElement('ul');
    featureList.className = 'pricing-card__features';
    plan.features.forEach((f) => {
      const li = document.createElement('li');
      li.textContent = f;
      featureList.appendChild(li);
    });

    const cta = document.createElement('a');
    cta.href = '#signup';
    cta.className = 'btn pricing-card__cta ' + (plan.popular ? 'btn--primary' : 'btn--ghost');
    cta.textContent = plan.cta;

    card.append(name, price, desc, divider, featureList, cta);
    container.appendChild(card);
    registerReveal(card);
  });
}

/* FAQ — built dynamically, ONE delegated click listener on the parent
   container instead of one listener per item. This sidesteps the
   attach/remove-per-item problem entirely (Phase 3 goal), and open/closed
   state is written to appState so a reload restores the same item open
   (Phase 2 goal). */
function renderFaq(items) {
  const container = document.getElementById('faqList');
  if (!container || !items?.length) return;
  clearContainer(container);

  items.forEach((item, i) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'faq-item';
    wrapper.dataset.index = String(i);
    wrapper.setAttribute('data-open', String(i === appState.faqOpenIndex));

    const button = document.createElement('button');
    button.className = 'faq-item__question';

    const index = document.createElement('span');
    index.className = 'faq-item__index';
    index.textContent = `Q${String(i + 1).padStart(2, '0')}`;

    const text = document.createElement('span');
    text.className = 'faq-item__text';
    text.textContent = item.q;

    const icon = document.createElement('span');
    icon.className = 'faq-item__icon';
    icon.setAttribute('aria-hidden', 'true');

    button.append(index, text, icon);

    const answer = document.createElement('div');
    answer.className = 'faq-item__answer';
    const p = document.createElement('p');
    p.textContent = item.a;
    answer.appendChild(p);

    wrapper.append(button, answer);
    container.appendChild(wrapper);
    registerReveal(wrapper);
  });

  container.addEventListener('click', handleFaqClick);
}

function handleFaqClick(e) {
  const button = e.target.closest('.faq-item__question');
  if (!button) return;
  const item = button.closest('.faq-item');
  const items = item.parentElement.querySelectorAll('.faq-item');
  const isOpen = item.getAttribute('data-open') === 'true';

  items.forEach((other) => other.setAttribute('data-open', 'false'));
  item.setAttribute('data-open', String(!isOpen));

  const openIndex = !isOpen ? Number(item.dataset.index) : -1;
  setState({ faqOpenIndex: openIndex });
  bus.emit('faq:toggled', openIndex);
}
