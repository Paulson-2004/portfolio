/* Progressive enhancements for navigation, reveal effects, and certificate previews. */
(function () {
  const pageStartTime = performance.now();
  function init() {
    const header = document.querySelector('.site-header');
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const menuToggle = document.querySelector('.navbar-toggler');
    const collapse = document.querySelector('.navbar-collapse');
    const year = document.getElementById('year');

    if (year) year.textContent = new Date().getFullYear();

    const setActiveLink = (id) => {
      navLinks.forEach((link) => {
        const isActive = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };

    const sections = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    let scrollFrame;
    const updateScrollState = () => {
      if (header) header.classList.toggle('scrolled', window.scrollY > 10);
      const marker = window.scrollY + (window.innerHeight * 0.38);
      const activeSection = sections.reduce((current, section) => (
        section.offsetTop <= marker ? section : current
      ), sections[0]);
      if (activeSection) setActiveLink(activeSection.id);
      scrollFrame = undefined;
    };
    const scheduleScrollState = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
    };
    updateScrollState();
    window.addEventListener('scroll', scheduleScrollState, { passive: true });

    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      document.querySelectorAll('.reveal:not(.hero .reveal)').forEach((element) => revealObserver.observe(element));

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
        if (event.key !== 'Tab') return;
        const focusable = Array.from(lightbox.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
    }

    const loader = document.getElementById('page-loader');
    const loaderLabel = document.getElementById('page-loader-label');
    let loaderTimer = null;
    let loaderHideTimeout = null;

    const hideLoader = (immediate = false) => {
      if (!loader) return;
      if (loaderTimer) {
        clearTimeout(loaderTimer);
        loaderTimer = null;
      }
      if (loaderHideTimeout) {
        clearTimeout(loaderHideTimeout);
        loaderHideTimeout = null;
      }
      loader.classList.remove('is-initial', 'is-active', 'is-passive');
      loader.setAttribute('aria-hidden', 'true');
      if (immediate) {
        loader.classList.remove('is-leaving');
        loader.hidden = true;
      } else {
        loader.classList.add('is-leaving');
        loaderHideTimeout = setTimeout(() => {
          loader.classList.remove('is-leaving');
          loader.hidden = true;
          loaderHideTimeout = null;
        }, 260);
      }
    };

    const showLoader = (isExternal, isNewTab) => {
      if (!loader) return;
      if (loaderTimer) clearTimeout(loaderTimer);
      if (loaderHideTimeout) {
        clearTimeout(loaderHideTimeout);
        loaderHideTimeout = null;
      }
      if (loaderLabel) {
        loaderLabel.textContent = isExternal ? 'Opening' : 'Loading';
      }
      loader.hidden = false;
      loader.classList.remove('is-initial', 'is-leaving');
      loader.setAttribute('aria-hidden', 'false');
      void loader.offsetWidth;
      loader.classList.add('is-active');

      if (isNewTab) {
        loader.classList.add('is-passive');
        loaderTimer = setTimeout(() => {
          hideLoader(false);
        }, 240);
      } else {
        loaderTimer = setTimeout(() => {
          hideLoader(false);
        }, 3000);
      }
    };

    const revealHero = () => {
      document.querySelectorAll('.hero .reveal').forEach((el) => el.classList.add('is-visible'));
    };

    let entranceHandled = false;
    const triggerEntrance = () => {
      if (entranceHandled) return;
      entranceHandled = true;

      const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        hideLoader(true);
        revealHero();
        return;
      }

      const elapsed = performance.now() - pageStartTime;
      const minDisplayTime = 460;
      const delay = Math.max(0, minDisplayTime - elapsed);

      setTimeout(() => {
        revealHero();
        hideLoader(false);
      }, delay);
    };

    const entranceSafetyTimer = setTimeout(triggerEntrance, 1500);

    const onPageReady = () => {
      clearTimeout(entranceSafetyTimer);
      triggerEntrance();
    };

    if (document.readyState === 'complete') {
      onPageReady();
    } else {
      window.addEventListener('load', onPageReady, { once: true });
    }

    document.addEventListener('click', (event) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (event.defaultPrevented) return;

      const link = event.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      const trimmedHref = href.trim();
      if (!trimmedHref || trimmedHref === '#' || trimmedHref.startsWith('#')) return;
      if (/^(mailto:|tel:|javascript:|data:|sms:)/i.test(trimmedHref)) return;
      if (link.hasAttribute('download')) return;
      if (link.hasAttribute('data-toggle') || link.hasAttribute('data-dismiss') || link.hasAttribute('data-certificate-close')) {
        return;
      }

      let targetUrl;
      try {
        targetUrl = new URL(link.href, window.location.href);
      } catch (err) {
        return;
      }

      const isSamePage = targetUrl.origin === window.location.origin &&
                         targetUrl.pathname === window.location.pathname &&
                         targetUrl.search === window.location.search;
      if (isSamePage) return;

      const isExternal = targetUrl.origin !== window.location.origin;
      const isNewTab = link.target === '_blank';

      showLoader(isExternal, isNewTab);
    });

    window.addEventListener('pageshow', () => {
      clearTimeout(entranceSafetyTimer);
      entranceHandled = true;
      revealHero();
      hideLoader(true);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeLightbox();
        hideLoader(true);
      }
    });

  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
