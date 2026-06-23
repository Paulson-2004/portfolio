'use strict';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const nav = document.querySelector('#sideNav');
const collapseElement = document.querySelector('#navbarSupportedContent');
const navLinks = [...document.querySelectorAll('.js-scroll-trigger[href^="#"]')];

navLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.querySelector(link.hash);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', link.hash);

    if (collapseElement.classList.contains('show')) {
      bootstrap.Collapse.getOrCreateInstance(collapseElement).hide();
    }
  });
});

const sections = [...document.querySelectorAll('main section[id]')];
const observer = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

  if (!visible) return;
  navLinks.forEach((link) => {
    const active = link.hash === `#${visible.target.id}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}, { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] });

sections.forEach((section) => observer.observe(section));
document.querySelector('#current-year').textContent = new Date().getFullYear();
