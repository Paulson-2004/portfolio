/* Navigation state and restrained entrance animations. */
(function () {
  const header = document.querySelector('.site-header');
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  const toggle = document.querySelector('.navbar-toggler');
  document.getElementById('year').textContent = new Date().getFullYear();
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(element => revealObserver.observe(element));
  const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id));
  }), { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  sections.forEach(section => navObserver.observe(section));
  if (toggle && window.jQuery) {
    jQuery('.navbar-collapse').on('shown.bs.collapse', () => toggle.classList.add('is-open'));
    jQuery('.navbar-collapse').on('hidden.bs.collapse', () => toggle.classList.remove('is-open'));
  }
  navLinks.forEach(link => link.addEventListener('click', () => { if (window.jQuery) jQuery('.navbar-collapse').collapse('hide'); }));
  window.addEventListener('scroll', () => header.classList.toggle('scrolled', window.scrollY > 10), { passive: true });
  const lightbox = document.getElementById('certificate-lightbox');
  const lightboxImage = document.getElementById('certificate-lightbox-image');
  const lightboxTitle = document.getElementById('certificate-lightbox-title');
  const closeLightbox = () => { lightbox.hidden = true; lightbox.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; };
  document.querySelectorAll('.certificate-image').forEach(button => button.addEventListener('click', () => {
    const title = button.dataset.certificateTitle;
    lightboxImage.src = button.querySelector('img').src;
    lightboxImage.alt = `Larger view of ${title}`;
    lightboxTitle.textContent = title;
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('.certificate-lightbox-close').focus();
  }));
  document.querySelectorAll('[data-certificate-close]').forEach(element => element.addEventListener('click', closeLightbox));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !lightbox.hidden) closeLightbox(); });
}());
