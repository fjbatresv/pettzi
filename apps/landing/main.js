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
