document.documentElement.classList.add('js');

const root = document.documentElement;
const themeButton = document.querySelector('.theme-toggle');
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');

try {
  const savedTheme = localStorage.getItem('pettzi-theme');
  if (savedTheme === 'light' || savedTheme === 'dark')
    root.dataset.theme = savedTheme;
} catch {}

themeButton?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('pettzi-theme', next);
  } catch {}
});

const closeMenu = () => {
  menuButton?.setAttribute('aria-expanded', 'false');
  nav?.classList.remove('is-open');
};
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  nav?.classList.toggle('is-open', open);
});
nav
  ?.querySelectorAll('a')
  .forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

const architecture = document.querySelector('.architecture');
const viewControls = architecture?.querySelector('.architecture-tabs');
const viewTabs = [...(viewControls?.querySelectorAll('[role="tab"]') ?? [])];
const viewMap = architecture?.querySelector('.system-map');
if (viewControls && viewMap && viewTabs.length) {
  const activateView = (tab, moveFocus = false) => {
    const view = tab.dataset.view;
    viewControls.dataset.activeView = view;
    viewMap.dataset.activeView = view;
    architecture.dataset.viewsEnhanced = 'true';
    viewTabs.forEach((candidate) => {
      const selected = candidate === tab;
      candidate.setAttribute('aria-selected', String(selected));
      candidate.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(
        candidate.getAttribute('aria-controls'),
      );
      if (panel) panel.hidden = !selected;
    });
    if (moveFocus) tab.focus();
  };

  viewTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateView(tab));
    tab.addEventListener('keydown', (event) => {
      let nextIndex;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % viewTabs.length;
      if (event.key === 'ArrowLeft')
        nextIndex = (index - 1 + viewTabs.length) % viewTabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = viewTabs.length - 1;
      if (nextIndex !== undefined) {
        event.preventDefault();
        activateView(viewTabs[nextIndex], true);
      }
    });
  });

  viewControls.hidden = false;
  activateView(viewTabs[0]);
}

const sections = [...document.querySelectorAll('main section[id]')];
if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveal.unobserve(entry.target);
        }
      }),
    { threshold: 0.12 },
  );
  document
    .querySelectorAll(
      '.section-heading,.principles article,.arch-notes article,.flow-grid article,.decision-grid article,.quality-inner,.doc-grid a',
    )
    .forEach((el) => {
      el.classList.add('reveal');
      reveal.observe(el);
    });
  const active = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (entry.isIntersecting)
          document
            .querySelector(`.nav a[href="#${entry.target.id}"]`)
            ?.setAttribute('aria-current', 'location');
        else
          document
            .querySelector(`.nav a[href="#${entry.target.id}"]`)
            ?.removeAttribute('aria-current');
      }),
    { rootMargin: '-30% 0px -60% 0px' },
  );
  sections.forEach((section) => active.observe(section));
}
