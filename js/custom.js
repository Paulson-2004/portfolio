/* Progressive enhancements: theme manager, scroll tracking, reveals, mobile drawer, native <dialog> modals, and toast feedback. */
(function () {
  function init() {
    const root = document.documentElement;
    const header = document.querySelector('.site-header');
    const progressBar = document.querySelector('.nav-progress');
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    const menuToggle = document.querySelector('.navbar-toggler');
    const navDrawer = document.getElementById('primary-nav');
    const themeToggle = document.getElementById('theme-toggle');
    const themeLabel = themeToggle && themeToggle.querySelector('.theme-toggle-label');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    const year = document.getElementById('year');

    if (year) year.textContent = new Date().getFullYear();

    /* ---------- 3-mode theme manager (System default / Light / Dark) ---------- */
    const THEME_KEY = 'portfolio_theme_v1';
    const THEME_MODES = ['system', 'light', 'dark'];
    const THEME_LABELS = { light: 'Light', dark: 'Dark', system: 'System' };
    const colorSchemeQuery = window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    const readStoredMode = () => {
      try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
      } catch (err) {
        // Storage blocked or unavailable; fall back to system default.
      }
      return 'system';
    };

    const writeStoredMode = (mode) => {
      try {
        localStorage.setItem(THEME_KEY, mode);
      } catch (err) {
        // Ignore storage quota or privacy-mode failures.
      }
    };

    const resolveTheme = (mode) => {
      if (mode === 'system') {
        return colorSchemeQuery && colorSchemeQuery.matches ? 'dark' : 'light';
      }
      return mode;
    };

    let currentMode = readStoredMode();

    const applyTheme = (mode) => {
      currentMode = mode;
      const resolved = resolveTheme(mode);
      root.dataset.theme = resolved;
      root.dataset.themeMode = mode;
      root.style.colorScheme = resolved;
      if (themeMeta) {
        themeMeta.setAttribute('content', resolved === 'dark' ? '#12151a' : '#fafafa');
      }
      if (themeToggle) {
        const nextMode = THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length];
        const stateText =
          mode === 'system' ? `System (${resolved === 'dark' ? 'Dark' : 'Light'})` : THEME_LABELS[mode];
        themeToggle.setAttribute(
          'aria-label',
          `Color theme: ${stateText}. Switch to ${THEME_LABELS[nextMode]}.`
        );
        themeToggle.setAttribute('title', `Theme: ${stateText} — click for ${THEME_LABELS[nextMode]}`);
      }
      if (themeLabel) {
        themeLabel.textContent = THEME_LABELS[mode];
      }
    };

    applyTheme(currentMode);

    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const nextMode = THEME_MODES[(THEME_MODES.indexOf(currentMode) + 1) % THEME_MODES.length];
        writeStoredMode(nextMode);
        applyTheme(nextMode);
      });
    }

    if (colorSchemeQuery) {
      const handleSystemThemeChange = () => {
        if (currentMode === 'system') applyTheme('system');
      };
      if (typeof colorSchemeQuery.addEventListener === 'function') {
        colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
      } else if (typeof colorSchemeQuery.addListener === 'function') {
        colorSchemeQuery.addListener(handleSystemThemeChange);
      }
    }

    /* ---------- Active section + scroll progress hairline ---------- */
    const setActiveLink = (id) => {
      navLinks.forEach((link) => {
        const isActive = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('active', isActive);
        if (isActive) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });
    };

    const sections = navLinks
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);

    let sectionOffsets = [];
    let maxScroll = 1;
    let markerOffset = window.innerHeight * 0.38;

    const measureLayout = () => {
      maxScroll = Math.max(1, root.scrollHeight - window.innerHeight);
      markerOffset = window.innerHeight * 0.38;
      sectionOffsets = sections.map((section) => ({
        id: section.id,
        top: section.offsetTop,
      }));
    };

    let scrollFrame = 0;
    const updateScrollState = () => {
      const scrollTop = window.scrollY;
      const progress = Math.min(1, Math.max(0, scrollTop / maxScroll));
      const marker = scrollTop + markerOffset;
      let activeId = sectionOffsets[0] ? sectionOffsets[0].id : '';
      for (let i = 0; i < sectionOffsets.length; i++) {
        if (sectionOffsets[i].top <= marker) activeId = sectionOffsets[i].id;
      }

      if (header) header.classList.toggle('scrolled', scrollTop > 10);
      if (progressBar) progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
      if (activeId) setActiveLink(activeId);
      scrollFrame = 0;
    };

    const scheduleScrollState = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
    };

    measureLayout();
    updateScrollState();
    window.addEventListener('scroll', scheduleScrollState, { passive: true });
    window.addEventListener(
      'resize',
      () => {
        measureLayout();
        scheduleScrollState();
      },
      { passive: true }
    );

    /* ---------- Scroll reveals ---------- */
    const revealEls = Array.from(document.querySelectorAll('.reveal'));
    if ('IntersectionObserver' in window) {
      const revealObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: '0px 0px -32px 0px' }
      );
      revealEls.forEach((el) => revealObserver.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add('is-visible'));
    }

    /* ---------- Native mobile navigation drawer ---------- */
    const setMenuOpen = (open) => {
      if (!menuToggle || !navDrawer) return;
      navDrawer.classList.toggle('is-open', open);
      menuToggle.classList.toggle('is-open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
    };

    if (menuToggle && navDrawer) {
      menuToggle.addEventListener('click', () => {
        setMenuOpen(!navDrawer.classList.contains('is-open'));
      });

      navLinks.forEach((link) => {
        link.addEventListener('click', () => setMenuOpen(false));
      });

      document.addEventListener('click', (event) => {
        if (!navDrawer.classList.contains('is-open')) return;
        if (!event.target.closest('.site-nav')) setMenuOpen(false);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && navDrawer.classList.contains('is-open')) {
          setMenuOpen(false);
          menuToggle.focus();
        }
      });
    }

    /* ---------- Native <dialog> modal & lightbox manager ---------- */
    const prefersReducedMotion = () =>
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const dialogTriggers = new WeakMap();
    const closingTimers = new WeakMap();

    const hydrateLazyMedia = (dialog) => {
      dialog.querySelectorAll('source[data-srcset]').forEach((srcEl) => {
        if (!srcEl.getAttribute('srcset')) {
          srcEl.setAttribute('srcset', srcEl.dataset.srcset);
        }
      });
      dialog.querySelectorAll('img[data-src]').forEach((imgEl) => {
        if (imgEl.dataset.loaded) return;
        imgEl.src = imgEl.dataset.src;
        imgEl.dataset.loaded = 'true';
      });
    };

    const finishClose = (dialog) => {
      dialog.classList.remove('is-closing');
      if (dialog.open) dialog.close();
      if (!document.querySelector('dialog[open]')) {
        document.body.classList.remove('is-dialog-open');
      }
      const trigger = dialogTriggers.get(dialog);
      if (trigger && typeof trigger.focus === 'function') {
        trigger.focus();
      }
      dialogTriggers.delete(dialog);
    };

    const closeDialog = (dialog) => {
      if (!dialog || !dialog.open) return;
      const existingTimer = closingTimers.get(dialog);
      if (existingTimer) {
        clearTimeout(existingTimer);
        closingTimers.delete(dialog);
      }

      if (prefersReducedMotion()) {
        finishClose(dialog);
        return;
      }

      dialog.classList.add('is-closing');
      const timer = setTimeout(() => {
        closingTimers.delete(dialog);
        finishClose(dialog);
      }, 240);
      closingTimers.set(dialog, timer);
    };

    const openDialog = (dialog, trigger) => {
      if (!dialog) return;
      const pendingTimer = closingTimers.get(dialog);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        closingTimers.delete(dialog);
      }
      dialog.classList.remove('is-closing');
      hydrateLazyMedia(dialog);
      if (trigger) dialogTriggers.set(dialog, trigger);
      document.body.classList.add('is-dialog-open');
      if (!dialog.open) dialog.showModal();
    };

    document.querySelectorAll('[data-dialog-open]').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const targetId = trigger.getAttribute('data-dialog-open');
        const dialog = targetId && document.getElementById(targetId);
        if (dialog) openDialog(dialog, trigger);
      });
    });

    document.querySelectorAll('dialog.app-dialog').forEach((dialog) => {
      dialog.querySelectorAll('[data-dialog-close]').forEach((btn) => {
        btn.addEventListener('click', () => closeDialog(dialog));
      });

      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) closeDialog(dialog);
      });

      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeDialog(dialog);
      });
    });

    /* ---------- Certificate lightbox ---------- */
    const lightbox = document.getElementById('certificate-lightbox');
    const lightboxImage = document.getElementById('certificate-lightbox-image');
    const lightboxTitle = document.getElementById('certificate-lightbox-title');

    if (lightbox && lightboxImage && lightboxTitle) {
      document.querySelectorAll('.certificate-image').forEach((button) => {
        button.addEventListener('click', () => {
          const title = button.dataset.certificateTitle || 'Certificate preview';
          const image = button.querySelector('img');
          if (!image) return;
          lightboxImage.src = image.currentSrc || image.src;
          lightboxImage.alt = `Larger view of ${title}`;
          lightboxTitle.textContent = title;
          openDialog(lightbox, button);
        });
      });
    }

    /* ---------- Projects progressive disclosure ---------- */
    const projectsToggle = document.getElementById('projects-toggle');
    const projectGrid = document.getElementById('project-grid');

    if (projectsToggle && projectGrid) {
      const projectCards = projectGrid.querySelectorAll('.project-card');
      const labelSpan = projectsToggle.querySelector('span');
      if (projectCards.length <= 3) {
        projectsToggle.parentElement.hidden = true;
      } else {
        projectsToggle.addEventListener('click', () => {
          const isExpanded = projectGrid.classList.toggle('is-expanded');
          projectsToggle.setAttribute('aria-expanded', String(isExpanded));
          if (labelSpan) {
            labelSpan.textContent = isExpanded
              ? 'Show fewer projects'
              : `View all ${projectCards.length} projects`;
          }
          if (isExpanded) {
            projectCards.forEach((card) => card.classList.add('is-visible'));
          }
          measureLayout();
          scheduleScrollState();
        });
      }
    }

    /* ---------- Copy email + micro-toast ---------- */
    const copyToast = document.getElementById('copy-toast');
    const copyToastText = document.getElementById('copy-toast-text');
    let toastTimer = null;
    let toastHideTimer = null;

    const showToast = (message) => {
      if (!copyToast || !copyToastText) return;
      if (toastTimer) clearTimeout(toastTimer);
      if (toastHideTimer) clearTimeout(toastHideTimer);
      copyToast.classList.remove('is-leaving');
      copyToastText.textContent = message;
      copyToast.hidden = false;

      toastTimer = setTimeout(() => {
        if (prefersReducedMotion()) {
          copyToast.hidden = true;
          return;
        }
        copyToast.classList.add('is-leaving');
        toastHideTimer = setTimeout(() => {
          copyToast.hidden = true;
          copyToast.classList.remove('is-leaving');
        }, 240);
      }, 2400);
    };

    document.querySelectorAll('[data-copy-email]').forEach((btn) => {
      const labelEl = btn.querySelector('span');
      let btnResetTimer = null;

      btn.addEventListener('click', async () => {
        const email = btn.getAttribute('data-copy-email');
        if (!email) return;

        let copied = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(email);
            copied = true;
          } catch (err) {
            copied = false;
          }
        }
        if (!copied) {
          const textarea = document.createElement('textarea');
          textarea.value = email;
          textarea.setAttribute('readonly', '');
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          try {
            copied = document.execCommand('copy');
          } catch (err) {
            copied = false;
          }
          document.body.removeChild(textarea);
        }

        if (copied) {
          btn.classList.add('is-copied');
          if (labelEl) labelEl.textContent = 'Copied';
          showToast(`Copied ${email}`);
          if (btnResetTimer) clearTimeout(btnResetTimer);
          btnResetTimer = setTimeout(() => {
            btn.classList.remove('is-copied');
            if (labelEl) labelEl.textContent = 'Copy';
          }, 2200);
        } else {
          showToast(email);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
