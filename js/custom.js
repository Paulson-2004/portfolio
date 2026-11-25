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
    let viewportHeight = 0;
    let docHeight = 1;
    let maxScroll = 1;
    let markerOffset = 0;

    const measureLayout = () => {
      viewportHeight = window.innerHeight;
      docHeight = root.scrollHeight;
      maxScroll = Math.max(1, docHeight - viewportHeight);
      markerOffset = viewportHeight * 0.38;
      sectionOffsets = sections.map((section) => ({
        id: section.id,
        top: section.offsetTop,
      }));
    };

    let scrollFrame = 0;
    const updateScrollState = () => {
      scrollFrame = 0;
      const scrollTop = window.scrollY;
      const liveViewport = window.innerHeight || viewportHeight;
      const liveDoc = root.scrollHeight || docHeight;
      const liveMaxScroll = Math.max(1, liveDoc - liveViewport);
      const progress = Math.min(1, Math.max(0, scrollTop / liveMaxScroll));
      const marker = scrollTop + liveViewport * 0.38;
      const isAtBottom = scrollTop + liveViewport >= liveDoc - 24;
      let activeId = sectionOffsets[0] ? sectionOffsets[0].id : '';
      if (isAtBottom && sectionOffsets.length) {
        activeId = sectionOffsets[sectionOffsets.length - 1].id;
      } else {
        for (let i = 0; i < sectionOffsets.length; i++) {
          if (sectionOffsets[i].top <= marker) activeId = sectionOffsets[i].id;
        }
      }

      if (header) header.classList.toggle('scrolled', scrollTop > 10);
      if (progressBar) progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
      if (activeId) setActiveLink(activeId);
    };

    const scheduleScrollState = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
    };

    window.requestAnimationFrame(() => {
      measureLayout();
      updateScrollState();
    });
    window.addEventListener('load', () => {
      window.requestAnimationFrame(() => {
        measureLayout();
        scheduleScrollState();
      });
    }, { once: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        measureLayout();
        scheduleScrollState();
      });
    }
    document.querySelectorAll('.timeline-details').forEach((details) => {
      details.addEventListener('toggle', () => {
        measureLayout();
        scheduleScrollState();
      });
    });
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
    const navBackdrop = document.getElementById('nav-backdrop');

    const setMenuOpen = (open) => {
      if (!menuToggle || !navDrawer) return;
      navDrawer.classList.toggle('is-open', open);
      menuToggle.classList.toggle('is-open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      if (navBackdrop) {
        navBackdrop.hidden = !open;
        navBackdrop.classList.toggle('is-open', open);
      }
    };

    if (menuToggle && navDrawer) {
      menuToggle.addEventListener('click', () => {
        setMenuOpen(!navDrawer.classList.contains('is-open'));
      });

      if (navBackdrop) {
        navBackdrop.addEventListener('click', () => setMenuOpen(false));
      }

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

      window.addEventListener(
        'resize',
        () => {
          if (window.innerWidth > 991 && navDrawer.classList.contains('is-open')) {
            setMenuOpen(false);
          }
        },
        { passive: true }
      );
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
      if (dialog.id === 'certificate-lightbox') {
        const lbImg = document.getElementById('certificate-lightbox-image');
        const lbTitle = document.getElementById('certificate-lightbox-title');
        if (lbImg) {
          lbImg.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
          lbImg.alt = '';
        }
        if (lbTitle) lbTitle.textContent = 'Certificate preview';
      }
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

    /* ---------- Project modal screenshot galleries ---------- */
    const galleryStates = new WeakMap();

    const showGallerySlide = (galleryEl, nextIndex) => {
      const state = galleryStates.get(galleryEl);
      if (!state || !state.slides.length) return;
      const total = state.slides.length;
      const index = ((nextIndex % total) + total) % total;
      const slide = state.slides[index];
      state.index = index;

      if (state.imgEl) {
        state.imgEl.src = slide.src;
        state.imgEl.alt = slide.alt || '';
        if (slide.width) state.imgEl.setAttribute('width', String(slide.width));
        if (slide.height) state.imgEl.setAttribute('height', String(slide.height));
        state.imgEl.classList.toggle('media-light-surface', Boolean(slide.light));
      }
      if (state.stageEl) {
        state.stageEl.classList.toggle('is-portrait', Boolean(slide.portrait));
      }
      if (state.captionEl) {
        state.captionEl.textContent = slide.caption || '';
      }
      if (state.counterEl) {
        state.counterEl.textContent = `${index + 1} / ${total}`;
      }
      state.thumbButtons.forEach((btn, idx) => {
        const isCurrent = idx === index;
        btn.setAttribute('aria-pressed', String(isCurrent));
        if (isCurrent && state.thumbsEl && !state.thumbsEl.hidden) {
          const targetLeft = btn.offsetLeft - (state.thumbsEl.clientWidth - btn.clientWidth) / 2;
          state.thumbsEl.scrollTo({
            left: Math.max(0, targetLeft),
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
          });
        }
      });
    };

    const ensureGalleryInitialized = (galleryEl) => {
      let state = galleryStates.get(galleryEl);
      if (!state) {
        let slides = [];
        try {
          slides = JSON.parse(galleryEl.dataset.gallery || '[]');
        } catch (err) {
          slides = [];
        }
        if (!Array.isArray(slides) || !slides.length) return null;

        const stageEl = galleryEl.querySelector('.dialog-gallery-stage');
        const imgEl = galleryEl.querySelector('.dialog-gallery-img');
        const prevBtn = galleryEl.querySelector('.gallery-prev');
        const nextBtn = galleryEl.querySelector('.gallery-next');
        const captionEl = galleryEl.querySelector('.gallery-caption');
        const counterEl = galleryEl.querySelector('.gallery-counter');
        const thumbsEl = galleryEl.querySelector('.gallery-thumbs');
        const isSingle = slides.length <= 1;

        if (prevBtn) prevBtn.hidden = isSingle;
        if (nextBtn) nextBtn.hidden = isSingle;
        if (counterEl) counterEl.hidden = isSingle;

        const thumbButtons = [];
        if (thumbsEl) {
          thumbsEl.hidden = isSingle;
          if (!isSingle && !thumbsEl.childElementCount) {
            slides.forEach((slide, idx) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = slide.portrait ? 'gallery-thumb is-portrait-thumb' : 'gallery-thumb';
              btn.setAttribute('aria-label', `Show screenshot ${idx + 1}: ${slide.thumbLabel || slide.alt || 'View'}`);
              btn.setAttribute('aria-pressed', String(idx === 0));

              const thumbImg = document.createElement('img');
              thumbImg.src = slide.src;
              thumbImg.alt = '';
              thumbImg.width = slide.width || 1440;
              thumbImg.height = slide.height || 900;
              thumbImg.loading = 'lazy';
              thumbImg.decoding = 'async';
              if (slide.light) thumbImg.className = 'media-light-surface';

              const labelSpan = document.createElement('span');
              labelSpan.textContent = slide.thumbLabel || `Slide ${idx + 1}`;

              btn.appendChild(thumbImg);
              btn.appendChild(labelSpan);
              btn.addEventListener('click', () => {
                showGallerySlide(galleryEl, idx);
              });
              thumbsEl.appendChild(btn);
              thumbButtons.push(btn);
            });
          }
        }

        state = {
          slides,
          index: 0,
          stageEl,
          imgEl,
          prevBtn,
          nextBtn,
          captionEl,
          counterEl,
          thumbsEl,
          thumbButtons,
        };
        galleryStates.set(galleryEl, state);

        if (prevBtn && !isSingle) {
          prevBtn.addEventListener('click', () => showGallerySlide(galleryEl, state.index - 1));
        }
        if (nextBtn && !isSingle) {
          nextBtn.addEventListener('click', () => showGallerySlide(galleryEl, state.index + 1));
        }
      }
      showGallerySlide(galleryEl, 0);
      return state;
    };

    /* ---------- ChapterWhen tabs, architecture nodes & reader themes ---------- */
    const cwModal = document.getElementById('modal-chapterwhen');
    if (cwModal) {
      const tabButtons = Array.from(cwModal.querySelectorAll('.modal-tab[role="tab"]'));
      const activateTab = (targetTab, shouldFocus) => {
        const panelId = targetTab.getAttribute('aria-controls');
        tabButtons.forEach((btn) => {
          const active = btn === targetTab;
          btn.setAttribute('aria-selected', String(active));
          btn.setAttribute('tabindex', active ? '0' : '-1');
        });
        cwModal.querySelectorAll('.modal-tab-panel[role="tabpanel"]').forEach((panel) => {
          panel.hidden = panel.id !== panelId;
        });
        if (shouldFocus) targetTab.focus();
      };

      tabButtons.forEach((tabBtn, idx) => {
        tabBtn.addEventListener('click', () => activateTab(tabBtn, false));
        tabBtn.addEventListener('keydown', (event) => {
          let nextIdx = -1;
          if (event.key === 'ArrowRight') nextIdx = (idx + 1) % tabButtons.length;
          else if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + tabButtons.length) % tabButtons.length;
          else if (event.key === 'Home') nextIdx = 0;
          else if (event.key === 'End') nextIdx = tabButtons.length - 1;
          if (nextIdx >= 0) {
            event.preventDefault();
            activateTab(tabButtons[nextIdx], true);
          }
        });
      });

      const ARCH_SPECS = {
        web: {
          title: 'Next.js 16 + React 19 (Vercel)',
          desc: 'App Router frontend styled with Tailwind CSS v4, offline service-worker chapter caching, Bookcloth/Folio/Classic reader editions, and shared TypeScript domain contracts across workspaces.',
        },
        api: {
          title: 'NestJS 12 REST API (Render)',
          desc: 'Modular TypeScript monolith spanning 25+ domain modules with Argon2id password hashing, HttpOnly JWT cookie sessions, CSRF origin and X-Requested-With verification, server-side HTML sanitization, and route throttling.',
        },
        db: {
          title: 'PostgreSQL 18 + Prisma 7 (Neon)',
          desc: 'Relational persistence connected via Prisma 7 (@prisma/adapter-pg) enforcing 3-tier server-side spoiler gates, versioned chapters, reading progress, bookmarks, and 3-level threaded comments.',
        },
        lore: {
          title: 'Tiptap Studio + @xyflow/react Universe',
          desc: 'Author Studio supporting Tiptap rich-text drafting, autosave, scheduled publishing, DOCX/PDF manuscript import, Web Speech API narration, and interactive @xyflow/react lore connection maps.',
        },
      };

      const archNodes = Array.from(cwModal.querySelectorAll('[data-arch-node]'));
      const archTitle = document.getElementById('cw-arch-title');
      const archDesc = document.getElementById('cw-arch-desc');

      archNodes.forEach((nodeBtn) => {
        nodeBtn.addEventListener('click', () => {
          const spec = ARCH_SPECS[nodeBtn.dataset.archNode];
          if (!spec) return;
          archNodes.forEach((btn) => btn.setAttribute('aria-pressed', String(btn === nodeBtn)));
          if (archTitle) archTitle.textContent = spec.title;
          if (archDesc) archDesc.textContent = spec.desc;
        });
      });

      const readerSwatches = Array.from(cwModal.querySelectorAll('[data-theme-choice]'));
      const readerExcerpt = document.getElementById('cw-reader-excerpt');
      readerSwatches.forEach((swatch) => {
        swatch.addEventListener('click', () => {
          const choice = swatch.dataset.themeChoice || 'paper';
          readerSwatches.forEach((btn) => btn.setAttribute('aria-pressed', String(btn === swatch)));
          if (readerExcerpt) readerExcerpt.dataset.readerTheme = choice;
        });
      });
    }

    const openDialog = (dialog, trigger) => {
      if (!dialog) return;
      const pendingTimer = closingTimers.get(dialog);
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        closingTimers.delete(dialog);
      }
      dialog.classList.remove('is-closing');
      hydrateLazyMedia(dialog);
      dialog.querySelectorAll('.dialog-gallery[data-gallery]').forEach((galleryEl) => {
        ensureGalleryInitialized(galleryEl);
      });
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

    /* ---------- Certificate filters & lightbox carousel ---------- */
    const certGrid = document.getElementById('certificate-grid');
    const certCards = certGrid ? Array.from(certGrid.querySelectorAll('.certificate-card')) : [];
    const certFilterBtns = Array.from(document.querySelectorAll('[data-cert-filter]'));
    const certFilterStatus = document.getElementById('cert-filter-status');

    const applyCertFilter = (filterKey) => {
      if (!certCards.length) return;
      const key = filterKey || 'all';
      let visibleCount = 0;

      certCards.forEach((card) => {
        const cats = (card.dataset.certCategory || '').split(/\s+/).filter(Boolean);
        const matches = key === 'all' || cats.includes(key);
        card.hidden = !matches;
        if (matches) visibleCount += 1;
      });

      certFilterBtns.forEach((btn) => {
        btn.setAttribute('aria-pressed', String(btn.dataset.certFilter === key));
      });
      if (certFilterStatus) {
        certFilterStatus.textContent = `Showing ${visibleCount} of ${certCards.length} certifications`;
      }
      measureLayout();
      scheduleScrollState();
    };

    certFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => applyCertFilter(btn.dataset.certFilter || 'all'));
    });

    const lightbox = document.getElementById('certificate-lightbox');
    const lightboxImage = document.getElementById('certificate-lightbox-image');
    const lightboxTitle = document.getElementById('certificate-lightbox-title');
    const lightboxCounter = document.getElementById('certificate-lightbox-counter');
    const lightboxPrev = document.getElementById('cert-lb-prev');
    const lightboxNext = document.getElementById('cert-lb-next');
    const lightboxVerify = document.getElementById('cert-lb-verify');

    let activeCertButtons = [];
    let activeCertIndex = 0;

    const showCertificateSlide = (nextIndex) => {
      if (!activeCertButtons.length || !lightboxImage || !lightboxTitle) return;
      const total = activeCertButtons.length;
      activeCertIndex = ((nextIndex % total) + total) % total;
      const btn = activeCertButtons[activeCertIndex];
      const title = btn.dataset.certificateTitle || 'Certificate preview';
      const verifyUrl = btn.dataset.verifyUrl || '';
      const image = btn.querySelector('img');
      if (!image) return;

      lightboxImage.src = image.currentSrc || image.src;
      lightboxImage.alt = `Larger view of ${title}`;
      lightboxImage.classList.toggle('media-light-surface', image.classList.contains('media-light-surface'));
      const natW = image.getAttribute('width');
      const natH = image.getAttribute('height');
      if (natW && natH) {
        lightboxImage.setAttribute('width', natW);
        lightboxImage.setAttribute('height', natH);
      }
      lightboxTitle.textContent = title;

      const isSingle = total <= 1;
      if (lightboxPrev) lightboxPrev.hidden = isSingle;
      if (lightboxNext) lightboxNext.hidden = isSingle;
      if (lightboxCounter) {
        lightboxCounter.hidden = isSingle;
        lightboxCounter.textContent = `${activeCertIndex + 1} / ${total}`;
      }
      if (lightboxVerify) {
        if (verifyUrl) {
          lightboxVerify.href = verifyUrl;
          lightboxVerify.hidden = false;
        } else {
          lightboxVerify.hidden = true;
          lightboxVerify.removeAttribute('href');
        }
      }
    };

    if (lightbox && lightboxImage && lightboxTitle) {
      document.querySelectorAll('.certificate-image').forEach((button) => {
        button.addEventListener('click', () => {
          activeCertButtons = Array.from(document.querySelectorAll('.certificate-image')).filter((item) => {
            const card = item.closest('.certificate-card');
            return !card || !card.hidden;
          });
          const idx = activeCertButtons.indexOf(button);
          activeCertIndex = idx >= 0 ? idx : 0;
          showCertificateSlide(activeCertIndex);
          openDialog(lightbox, button);
        });
      });

      if (lightboxPrev) {
        lightboxPrev.addEventListener('click', () => showCertificateSlide(activeCertIndex - 1));
      }
      if (lightboxNext) {
        lightboxNext.addEventListener('click', () => showCertificateSlide(activeCertIndex + 1));
      }
    }

    document.addEventListener('keydown', (event) => {
      const openDialogEl = document.querySelector('dialog.app-dialog[open]');
      if (!openDialogEl) return;
      if (event.target && event.target.closest('input, textarea, select')) return;
      if (event.target && event.target.closest('.modal-tabs')) return;

      if (openDialogEl === lightbox) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          showCertificateSlide(activeCertIndex - 1);
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          showCertificateSlide(activeCertIndex + 1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          showCertificateSlide(0);
        } else if (event.key === 'End' && activeCertButtons.length) {
          event.preventDefault();
          showCertificateSlide(activeCertButtons.length - 1);
        }
        return;
      }

      const activePanel = openDialogEl.querySelector('.modal-tab-panel:not([hidden])');
      const galleryEl = activePanel
        ? activePanel.querySelector('.dialog-gallery[data-gallery]')
        : openDialogEl.querySelector('.dialog-gallery[data-gallery]');
      if (!galleryEl) return;
      const state = galleryStates.get(galleryEl);
      if (!state || state.slides.length <= 1) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showGallerySlide(galleryEl, state.index - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        showGallerySlide(galleryEl, state.index + 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        showGallerySlide(galleryEl, 0);
      } else if (event.key === 'End') {
        event.preventDefault();
        showGallerySlide(galleryEl, state.slides.length - 1);
      }
    });

    /* ---------- Projects progressive disclosure, filters & skill cross-links ---------- */
    const projectsToggle = document.getElementById('projects-toggle');
    const projectGrid = document.getElementById('project-grid');
    const projectCards = projectGrid ? Array.from(projectGrid.querySelectorAll('.project-card')) : [];
    const projectFilterBtns = Array.from(document.querySelectorAll('[data-project-filter]'));
    const projectFilterStatus = document.getElementById('project-filter-status');
    const toggleLabelSpan = projectsToggle && projectsToggle.querySelector('span');
    let skillHighlightTimer = null;

    const updateToggleUi = (isExpanded) => {
      if (!projectsToggle) return;
      projectsToggle.setAttribute('aria-expanded', String(isExpanded));
      if (toggleLabelSpan) {
        toggleLabelSpan.textContent = isExpanded
          ? 'Show fewer projects'
          : `View all ${projectCards.length} projects`;
      }
    };

    const applyProjectFilter = (mode, skillKey, skillLabel) => {
      if (!projectGrid || !projectCards.length) return;
      if (skillHighlightTimer) {
        clearTimeout(skillHighlightTimer);
        skillHighlightTimer = null;
      }
      projectCards.forEach((card) => card.classList.remove('is-skill-highlight'));

      if (mode === 'all') {
        projectGrid.classList.remove('is-filtered');
        projectCards.forEach((card) => {
          card.hidden = false;
        });
        if (projectsToggle && projectsToggle.parentElement) {
          projectsToggle.parentElement.hidden = projectCards.length <= 3;
        }
        const isExpanded = projectGrid.classList.contains('is-expanded');
        updateToggleUi(isExpanded);
        if (projectFilterStatus) {
          projectFilterStatus.textContent = isExpanded
            ? `Showing all ${projectCards.length} projects`
            : `Showing top 3 of ${projectCards.length} projects`;
        }
        projectFilterBtns.forEach((btn) => {
          btn.setAttribute('aria-pressed', String(btn.dataset.projectFilter === 'all'));
        });
      } else if (mode === 'skill' && skillKey) {
        projectGrid.classList.add('is-filtered');
        const matchedCards = [];
        projectCards.forEach((card) => {
          const skills = (card.dataset.skills || '').split(/\s+/).filter(Boolean);
          const matches = skills.includes(skillKey);
          card.hidden = !matches;
          if (matches) {
            card.classList.add('is-visible');
            matchedCards.push(card);
          }
        });
        if (projectsToggle && projectsToggle.parentElement) {
          projectsToggle.parentElement.hidden = true;
        }
        projectFilterBtns.forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
        if (projectFilterStatus) {
          const label = skillLabel || skillKey;
          projectFilterStatus.textContent = `Showing ${matchedCards.length} project${matchedCards.length === 1 ? '' : 's'} using ${label}`;
        }
        if (matchedCards.length) {
          matchedCards.forEach((card) => card.classList.add('is-skill-highlight'));
          skillHighlightTimer = setTimeout(() => {
            matchedCards.forEach((card) => card.classList.remove('is-skill-highlight'));
          }, 1600);
        }
      } else {
        projectGrid.classList.add('is-filtered');
        let visibleCount = 0;
        projectCards.forEach((card) => {
          const cats = (card.dataset.category || '').split(/\s+/).filter(Boolean);
          const matches = cats.includes(mode);
          card.hidden = !matches;
          if (matches) {
            card.classList.add('is-visible');
            visibleCount += 1;
          }
        });
        if (projectsToggle && projectsToggle.parentElement) {
          projectsToggle.parentElement.hidden = true;
        }
        projectFilterBtns.forEach((btn) => {
          btn.setAttribute('aria-pressed', String(btn.dataset.projectFilter === mode));
        });
        if (projectFilterStatus) {
          projectFilterStatus.textContent = `Showing ${visibleCount} of ${projectCards.length} projects`;
        }
      }

      measureLayout();
      scheduleScrollState();
    };

    if (projectsToggle && projectGrid) {
      if (projectCards.length <= 3) {
        projectsToggle.parentElement.hidden = true;
      } else {
        projectsToggle.addEventListener('click', () => {
          const isExpanded = projectGrid.classList.toggle('is-expanded');
          updateToggleUi(isExpanded);
          if (isExpanded) {
            projectCards.forEach((card) => card.classList.add('is-visible'));
          }
          if (projectFilterStatus) {
            projectFilterStatus.textContent = isExpanded
              ? `Showing all ${projectCards.length} projects`
              : `Showing top 3 of ${projectCards.length} projects`;
          }
          measureLayout();
          scheduleScrollState();
        });
      }
    }

    projectFilterBtns.forEach((btn) => {
      btn.addEventListener('click', () => applyProjectFilter(btn.dataset.projectFilter || 'all'));
    });

    document.querySelectorAll('.skill-chip[data-skill-key]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.skillKey;
        if (!key) return;
        applyProjectFilter('skill', key, chip.textContent.trim());
        const targetSection = document.getElementById('projects');
        if (targetSection) {
          targetSection.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start',
          });
        }
      });
    });

    document.querySelectorAll('.skill-chip[data-skill-scroll]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const certFilter = chip.dataset.certFilter;
        if (certFilter) applyCertFilter(certFilter);
        const targetSelector = chip.dataset.skillScroll;
        const target = targetSelector ? document.querySelector(targetSelector) : null;
        if (target) {
          target.scrollIntoView({
            behavior: prefersReducedMotion() ? 'auto' : 'smooth',
            block: 'start',
          });
        }
      });
    });

    /* ---------- Phone on-demand reveal ---------- */
    const revealPhoneBtn = document.getElementById('reveal-phone-btn');
    const phoneSlot = document.getElementById('phone-slot');
    if (revealPhoneBtn && phoneSlot) {
      let phoneVisible = false;
      revealPhoneBtn.addEventListener('click', () => {
        phoneVisible = !phoneVisible;
        phoneSlot.textContent = '';
        if (phoneVisible) {
          const groups = [
            [43, 57, 49],
            [57, 51, 54, 48, 57],
            [53, 56, 52, 55, 57],
          ].map((codes) => String.fromCharCode(...codes));
          const displayPhone = `${groups[0]} ${groups[1]} ${groups[2]}`;
          const link = document.createElement('a');
          link.className = 'phone-revealed-link';
          link.href = `tel:${groups.join('')}`;
          link.textContent = displayPhone;
          phoneSlot.appendChild(link);
          revealPhoneBtn.textContent = 'Hide phone';
          revealPhoneBtn.setAttribute('aria-expanded', 'true');
        } else {
          const strong = document.createElement('strong');
          strong.textContent = 'Available on request';
          phoneSlot.appendChild(strong);
          revealPhoneBtn.textContent = 'Reveal phone';
          revealPhoneBtn.setAttribute('aria-expanded', 'false');
        }
      });
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
