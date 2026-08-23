/* Progressive enhancements for navigation, reveal effects, and certificate previews. */
(function () {
  function init() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const header = document.querySelector('.site-header');
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const menuToggle = document.querySelector('.navbar-toggler');
    const collapse = document.querySelector('.navbar-collapse');
    const year = document.getElementById('year');
    const hero = document.querySelector('.hero');

    if (year) year.textContent = new Date().getFullYear();

    const setHeaderState = () => {
      if (header) header.classList.toggle('scrolled', window.scrollY > 10);
    };
    setHeaderState();
    window.addEventListener('scroll', setHeaderState, { passive: true });

    const setActiveLink = (id) => {
      navLinks.forEach((link) => {
        const isActive = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };

    const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

      const navObserver = new IntersectionObserver((entries) => {
        const visibleSection = entries.find((entry) => entry.isIntersecting);
        if (visibleSection) setActiveLink(visibleSection.target.id);
      }, { rootMargin: '-28% 0px -62% 0px', threshold: 0 });
      sections.forEach((section) => navObserver.observe(section));
    } else {
      document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
    }

    if (menuToggle && collapse && window.jQuery) {
      const $collapse = window.jQuery(collapse);
      $collapse.on('shown.bs.collapse', () => menuToggle.classList.add('is-open'));
      $collapse.on('hidden.bs.collapse', () => menuToggle.classList.remove('is-open'));
      navLinks.forEach((link) => link.addEventListener('click', () => $collapse.collapse('hide')));
    }

    const lightbox = document.getElementById('certificate-lightbox');
    const lightboxImage = document.getElementById('certificate-lightbox-image');
    const lightboxTitle = document.getElementById('certificate-lightbox-title');
    const closeButton = lightbox && lightbox.querySelector('.certificate-lightbox-close');
    let lightboxTrigger = null;

    const closeLightbox = () => {
      if (!lightbox || lightbox.hidden) return;
      lightbox.hidden = true;
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('is-dialog-open');
      if (lightboxTrigger) lightboxTrigger.focus();
      lightboxTrigger = null;
    };

    if (lightbox && lightboxImage && lightboxTitle && closeButton) {
      document.querySelectorAll('.certificate-image').forEach((button) => {
        button.addEventListener('click', () => {
          const title = button.dataset.certificateTitle || 'Certificate preview';
          const image = button.querySelector('img');
          if (!image) return;
          lightboxTrigger = button;
          lightboxImage.src = image.currentSrc || image.src;
          lightboxImage.alt = `Larger view of ${title}`;
          lightboxTitle.textContent = title;
          lightbox.hidden = false;
          lightbox.setAttribute('aria-hidden', 'false');
          document.body.classList.add('is-dialog-open');
          closeButton.focus();
        });
      });
      lightbox.querySelectorAll('[data-certificate-close]').forEach((element) => element.addEventListener('click', closeLightbox));
      lightbox.addEventListener('keydown', (event) => {
        if (event.key === 'Tab') {
          event.preventDefault();
          closeButton.focus();
        }
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeLightbox();
    });

    if (hero && !prefersReducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let animationFrame;
      hero.addEventListener('pointermove', (event) => {
        const bounds = hero.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / bounds.width * 100).toFixed(2);
        const y = ((event.clientY - bounds.top) / bounds.height * 100).toFixed(2);
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(() => {
          hero.style.setProperty('--pointer-x', `${x}%`);
          hero.style.setProperty('--pointer-y', `${y}%`);
        });
      });
      hero.addEventListener('pointerleave', () => {
        hero.style.removeProperty('--pointer-x');
        hero.style.removeProperty('--pointer-y');
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
