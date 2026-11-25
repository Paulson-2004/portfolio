# Portfolio — Dark Theme & Layout Density Refinement Plan

> **Document Type:** Stage 1 Implementation Plan (Investigation & Planning Only — Awaiting User Approval)  
> **Repository Verified:** `D:/Project/VS Code/portfolio` (`Paulson-2004/portfolio`, branch `main`, remote `origin -> https://github.com/Paulson-2004/portfolio.git`)  
> **Primary Domain:** `https://paulsonj.me/` (with `https://portfolio.jpaulson2004.workers.dev/` preserved)  
> **Prerequisite Context:** Builds upon the recently implemented Phases 1–3 in the working tree without modifying `docs/planning/PORTFOLIO_UI_UX_ANIMATION_AND_CHAPTERWHEN_PLAN.md`.

---

## 1. Stage 1 Investigation Findings (Verified Against Current Implementation)

All measurements and observations below were verified directly from `index.html`, `css/style.css`, `js/custom.js`, `img/favicon.svg`, and a live Playwright inspection of the current local implementation across `1440×900`, `1024×768`, `768×1024`, and `375×812`.

### 1.1 Current Theme & Styling Inventory
- **Zero-build stack preserved:** `index.html` (pure HTML5 + inline `<svg>` `<symbol>` sprite), `css/style.css` (custom design system, CSS variables, native `<dialog>`, `@starting-style`), `js/custom.js` (vanilla JS scroll tracking, `IntersectionObserver`, mobile drawer, `<dialog>` manager, copy-email toast).
- **Color tokens today (`css/style.css`):** Light-only palette (`--paper: #fafafa`, `--paper-alt: #f1f1ee`, `--ink: #15171b`, `--ink-soft: #31343b`, `--muted: #565c64`, `--line: #dfe0dc`, `--line-strong: #c8c9c4`, `--accent: #2e5266`, `--accent-ink: #1a333f`, `--white: #ffffff`).
- **Hardcoded light colors that currently ignore tokens:**
  - `#fff` / `rgba(250,250,250,.88)` / `rgba(21,23,27,...)` appear directly on `.site-nav`, `.project-card`, `.certificate-card`, `.dialog-panel`, `.dialog-close`, `.navbar-nav` (mobile drawer), `.button-primary`, `.button-light`, and `.toast` instead of semantic surface/text tokens.
  - `#contact` and `.site-footer` use `background: var(--ink)` (`#15171b`) with hardcoded light text (`#fff`, `#a8becb`, `#c2c7cd`, `#dcdfe3`).
- **Media assets requiring theme-aware framing:**
  - `img/profile.webp` / `img/profile-sm.webp` / `img/profile.png` have transparent backgrounds (`hasAlpha: true`) with dark hair and a dark-charcoal suit. Without an intentional frame/surface plate in dark mode, dark edges will blend into a dark background.
  - Project screenshots (`ChapterWhen` Bookcloth light, `FinGrow`, `College Fees`), `img/resume-preview.webp`, and the 7 certificate `.webp` scans have bright white backgrounds that need subtle border framing and restrained brightness softening in dark mode to prevent glare.
  - `img/favicon.svg` already uses a `#15171b` pill with `#2e5266` border and `#fafafa` monogram, reading crisply on both light and dark browser tabs.

### 1.2 Current Measured Layout Density & Causes of Excessive Whitespace

| Viewport | Total Page Height | `#about` (Hero) | `#experience` | `#projects` | `#skills` | `#education` (Edu + 7 Certs) | `#updates` | `#contact` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **`1440×900`** | **6,642 px** | 680 px | 965 px | 1,336 px | 564 px | **1,822 px** | 533 px | 435 px |
| **`1024×768`** | **6,453 px** | 680 px | 908 px | 1,306 px | 555 px | **1,746 px** | 525 px | 426 px |
| **`768×1024`** | **7,651 px** | 899 px | 880 px | 1,650 px | 637 px | **2,098 px** | 518 px | 672 px |
| **`375×812`** | **10,742 px** | 1,049 px | 1,262 px | 2,155 px | 892 px | **3,653 px** | 681 px | 722 px |

**Verified root causes of excessive whitespace:**
1. **Generous uniform section padding (`80px 0`):** Adjacent sections create **`160px`** of combined vertical empty space (`80px` bottom + `80px` top) between every band, while `#contact` spends **`192px`** (`96px` top + `96px` bottom) on empty vertical padding alone (~44% of its total height).
2. **Hero minimum height & gap (`680px` desktop / `1,049px` mobile):** `.hero` enforces `min-height: min(680px, calc(100vh - 74px))` with `gap: 4.5rem` (`72px`) and a `430px` portrait (`511px` tall with caption), leaving unused vertical space above/below `.hero-copy` and pushing `#experience` further down.
3. **Education + 7 Certificate cards (`1,822px` desktop / `3,653px` mobile):** Each of the 6 regular certificate cards is `418px` tall on desktop (`aspect-ratio: 1.35` + generous copy padding). On `375px` mobile, all 7 cards stack vertically as full-width image-top cards, creating **`3,653px`**—over one-third of the entire mobile scroll height!
4. **Supporting project cards taller than featured card (`547px` vs `369px`):** At `1440px`, `ReWear` and `FinGrow` stand `178px` taller than the horizontal featured `ChapterWhen` card due to `16:9` image height (`326px`) plus generous `.project-body` padding (`20px 22px`) and badge/link spacing.
5. **Chronology & Skill row padding:** `.timeline-item` (`padding-bottom: 20px; margin-bottom: 20px` = `40px` between items), `.education-card` (`padding: 20px 0`), and `.skill-card` (`padding: 22px 0`) leave excessive vertical gaps between single-sentence items.

---

## 2. Design Decisions & Trade-Offs

### 2.1 Theme Resolution & Default Behavior (Important Decision)
There are two ways to combine *"Preserve the existing light theme as the default appearance for users without a saved preference"* and *"Support system preference detection using `prefers-color-scheme`"*:

- **Recommended Approach — 3-Mode Theme System (`Light` default / `Dark` / `System`) with Light First-Visit Default:**
  - **Behavior:** When `localStorage.getItem('portfolio_theme_v1')` is unset, the site defaults to **`light`** (strictly preserving the existing light appearance for first-time visitors, regardless of OS dark mode).
  - **Controls:** Clicking the header theme toggle switches cleanly between **Light** and **Dark** (persisting the explicit choice in `localStorage`), while an accessible mode control or cycle (`Light` ↔ `Dark`, plus optional `System` sync or `Shift`/menu toggle — **recommended clean UX:** a crisp 3-option segmented pill or cycle `Light` → `Dark` → `System`, OR a clean 2-button/cycle control labeled clearly `Light` / `Dark` / `Auto`) lets users opt into live OS `prefers-color-scheme` synchronization (`matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)`).
  - **Alternative Trade-Off (OS-first):** Auto-applying dark mode on first visit whenever `prefers-color-scheme: dark` matches. *Why not chosen by default:* On machines configured with OS dark mode, a visitor with no saved preference would never see the light theme first, conflicting with *"Preserve the existing light theme as the default appearance for users without a saved preference."*
  - **Clarification note:** We recommend implementing **Default `light` with `Light / Dark / System` support** (explicitly defaulting to `light` when no `localStorage` entry exists, and actively tracking `prefers-color-scheme` whenever `system` is chosen). If you prefer OS-first (`system` as the initial default instead of `light`), that is a 1-line change in the inline head script.

### 2.2 Theme Toggle Placement & Accessibility
- Place the theme control in `.nav-inner` right beside `.navbar-toggler` on mobile (`order` before hamburger) and at the right end of `.navbar-nav` on desktop (`>= 992px`).
- **Why here:** Keeps theme switching 1 tap away on mobile without opening the drawer, preserves clean brand balance on the left, meets `>= 40×40px` touch target size, and communicates current state cleanly via `aria-label` (e.g., `Theme: Light — switch to Dark`) + inline SVG icon (`sun` / `moon` / `monitor`).

### 2.3 Density Strategy: Context-Aware Rhythm Over Blanket Shrinking
- **Container width:** Keep `max-width: 1140px` (down slightly from `1180px`, `padding: 0 24px`) so 2-column project cards, skill rows, and timeline prose feel tighter and better proportioned on `1440px` and `1920px` displays without crowding `1024px`.
- **Do not shrink body font size or line-height:** Maintain `16px` desktop (`15px` mobile) and `line-height: 1.65–1.7` (`max-width: 60ch–65ch`) so editorial readability never feels cramped.
- **Target mobile `#education` fix:** Switching the 7 certificate cards on `<= 767px` from giant stacked image-top cards to **compact horizontal cards** (`96px` wide thumbnail left + copy right) preserves all 7 certificates and lightbox zoom while cutting mobile scroll height by ~2,200px!

---

## 3. Complete Dark Theme Architecture

### 3.1 Zero-FOUC Initialization & Persistence
Add a minimal synchronous inline `<script>` inside `<head>` **immediately before** `<link href="css/style.css" rel="stylesheet">`:
1. Reads `portfolio_theme_v1` from `localStorage` inside `try/catch` (`'light'`, `'dark'`, or `'system'`; defaults to `'light'` if absent or invalid).
2. Resolves effective theme: if `'system'`, reads `window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`.
3. Sets `document.documentElement.dataset.theme = resolved`, `document.documentElement.dataset.themeMode = mode`, and `document.documentElement.style.colorScheme = resolved`.
4. Updates `<meta name="theme-color">` (`#fafafa` for light, `#12151a` for dark) before first paint—guaranteeing **zero flash of wrong theme (FOUC)**.
5. In `js/custom.js`, binds a `change` listener on `window.matchMedia('(prefers-color-scheme: dark)')` so users in `system` mode update live when OS appearance changes.

### 3.2 Semantic Theme Token System (`css/style.css`)

| Semantic Token | Light (`:root` / `[data-theme="light"]`) | Dark (`[data-theme="dark"]`) | Purpose & Contrast Notes |
| --- | --- | --- | --- |
| `--paper` | `#fafafa` | `#12151a` | Primary page canvas (warm-neutral deep charcoal-slate, never pure `#000`) |
| `--paper-alt` | `#f1f1ee` | `#181c23` | Alternating section surface (`#projects`, `#education`) |
| `--surface` | `#ffffff` | `#1d222b` | Elevated card & modal panel surface |
| `--surface-subtle` | `#fafafa` | `#232934` | Badges, image placeholders, resume embed container |
| `--ink` | `#15171b` | `#eef0f4` | Primary headings & text (~15.2:1 on `#12151a`) |
| `--ink-soft` | `#31343b` | `#cbd1da` | Role labels, update copy, case-study bullets (~10.5:1) |
| `--muted` | `#565c64` | `#9aa3b2` | Secondary copy, metadata, captions (~5.8:1 on `#1d222b` — WCAG AA compliant) |
| `--line` | `#dfe0dc` | `#2b313d` | Hairline dividers, card borders, timeline connectors |
| `--line-strong` | `#c8c9c4` | `#3e4656` | Control borders, hover borders, dashed repo badge |
| `--accent` | `#2e5266` | `#74a5c0` | Brand slate-blue accent (~6.4:1 on `#12151a`, ~5.5:1 on `#1d222b`) |
| `--accent-ink` | `#1a333f` | `#95c0d8` | Accent hover & active emphasis |
| `--btn-primary-bg` | `#15171b` | `#eef0f4` | Primary CTA fill |
| `--btn-primary-fg` | `#ffffff` | `#12151a` | Primary CTA label |
| `--btn-primary-hover` | `#1a333f` | `#d5dce6` | Primary CTA hover |
| `--nav-bg` | `rgba(250, 250, 250, .88)` | `rgba(18, 21, 26, .88)` | Translucent sticky header |
| `--nav-bg-scrolled` | `rgba(250, 250, 250, .96)` | `rgba(18, 21, 26, .96)` | Scrolled sticky header |
| `--contact-bg` | `#15171b` | `#0d1015` | Distinct dark closing anchor (`#contact` + `footer` + top border in dark mode) |
| `--contact-muted` | `#c2c7cd` | `#aeb6c2` | Contact body copy |
| `--contact-subtle` | `#9da4ac` | `#8f98a6` | Contact labels & footer metadata |
| `--backdrop` | `rgba(21, 23, 27, .72)` | `rgba(6, 8, 11, .82)` | Native `<dialog>::backdrop` scrim |
| `--toast-bg` | `#15171b` | `#232934` | Floating toast background with `1px solid var(--line-strong)` |
| `--toast-fg` | `#ffffff` | `#eef0f4` | Floating toast text |
| `--shadow-card` | `0 10px 26px rgba(21, 23, 27, .06)` | `0 12px 28px rgba(0, 0, 0, .35)` | Restrained hover lift shadow |
| `--shadow-dialog` | `0 24px 60px rgba(21, 23, 27, .22)` | `0 28px 68px rgba(0, 0, 0, .55)` | Dialog elevation |

### 3.3 Component-by-Component Dark Theme Audit
1. **Header, Nav & Mobile Drawer:** `.site-nav` uses `var(--nav-bg)` + `var(--line)`; `.nav-progress` uses `var(--accent)` (`#74a5c0` in dark); mobile `.navbar-nav` uses `var(--surface)` + `var(--line)` instead of hardcoded `#fff`; `.navbar-toggler span` uses `var(--ink)`.
2. **Hero & Transparent Portrait (`img/profile.webp`):** In `[data-theme="dark"]`, `.portrait-frame` gets a subtle architectural plate (`background: linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01)); background-color: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 12px 0;`) so Paulson's dark hair and dark suit shoulders separate cleanly from the `#12151a` canvas while remaining natural in light mode (no box in light mode).
3. **Section Headings, Separators, Timeline, Skills, Education, Updates:** All borders use `var(--line)`, active timeline/education dots use `var(--accent)`, headings use `var(--ink)`, descriptions use `var(--muted)`.
4. **Projects & Featured ChapterWhen Card:** `.project-card` uses `var(--surface)` + `var(--line)`; `.badges span` use `var(--surface-subtle)` + `var(--ink-soft)`; `.repo-status` uses `var(--line-strong)`; bright light-mode screenshots (`ChapterWhen`, `FinGrow`, `College Fees`) receive a subtle dark-mode glare reduction (`filter: brightness(.93) contrast(1.03)`) inside dark cards while returning to crisp full brightness on hover or focus.
5. **Project Dialogs, Résumé Dialog & Certificate Lightbox:** `.dialog-panel` uses `var(--surface)` + `var(--line)`; `.dialog-close` uses `var(--surface-subtle)` + `var(--ink)` + `var(--line-strong)`; `.resume-embed-container` and lightbox image backgrounds use `var(--surface-subtle)`; `.case-study-grid` headings use `var(--accent)`. Certificate images and the résumé preview receive gentle `brightness(.94)` in dark mode so white scans don't flash painfully against `#1d222b`.
6. **Contact & Footer:** Uses `var(--contact-bg)` (`#0d1015` in dark mode with `border-top: 1px solid var(--line)` separating it cleanly from `#updates` `#12151a`). `.copy-email-btn` and `.contact-social a` retain crisp contrast and check feedback (`#8ee0b5`).
7. **Buttons, Focus Rings & SVG Icons:** All inline `<svg class="icon">` inherit `currentColor` cleanly; `:focus-visible` outlines use `2px solid var(--accent)` (`#74a5c0` in dark mode, `>= 5.5:1` contrast against `#12151a` and `#1d222b`).

---

## 4. Balanced Layout Density & Spacing Scale Plan

### 4.1 Semantic Spacing Scale (`css/style.css`)

```css
:root {
  --container-max: 1140px;
  --space-section-y: 56px;
  --space-section-y-sm: 40px;
  --space-heading-b: 24px;
  --gap-grid: 18px;
}
```

### 4.2 Targeted Spacing Adjustments (Current vs Proposed)

| Area / Selector | Current Value | Proposed Value | Rationale |
| --- | --- | --- | --- |
| **Container** (`.container`, `.nav-inner`) | `max-width: 1180px` | `max-width: 1140px` | Reduces horizontal sprawl on 1440px/1920px while keeping comfortable 2/3-col proportions |
| **Header** (`.site-header`, `.site-nav`) | `74px` (`64px` <=991px) | `66px` (`60px` <=991px) | Sleeker sticky bar, recovers vertical viewport space above the fold |
| **Hero** (`#about`) | `min-height: min(680px, calc(100vh - 74px))`, `padding: 52px 0 64px`, `gap: 4.5rem`, portrait `430px` | `min-height: auto`, `padding: 40px 0 48px` (`32px 0 38px` <=991px, `24px 0 34px` <=767px), `gap: 3rem`, portrait `376px` (`248px` <=767px) | Eliminates dead vertical void above/below copy; brings Experience teaser closer into view |
| **Standard Sections** (`#experience`, `#projects`, `#skills`, `#education`) | `padding: 80px 0` (`160px` combined gap!) | `padding: 56px 0` (`44px 0` <=991px, `38px 0` <=767px) | Cuts combined inter-section gap from `160px` to `112px` while keeping crisp section separation |
| **Section Headings** (`.section-heading`) | `margin-bottom: 34px` | `margin-bottom: 24px` (`20px` <=767px) | Tighter visual link between heading and content |
| **Experience** (`.timeline-item`) | `200px 20px 1fr`, `gap: 28px`, `pb: 20px; mb: 20px` | `180px 18px 1fr`, `gap: 22px`, `pb: 15px; mb: 15px` | Reduces `40px` inter-row gap to `30px` for tighter chronology scanning |
| **Projects** (`.project-grid`, `.project-card`) | `gap: 22px`; featured `min-height: 320px`, `padding: 26px 30px`; supporting `padding: 20px 22px` | `gap: 18px`; featured `min-height: 280px`, `padding: 22px 24px`; supporting `padding: 16px 18px`, `.badges` `margin: 10px 0 12px` | Balances supporting card height (~450px) closer to featured card (~330px) |
| **Skills** (`.skills-grid`, `.skill-card`) | `column-gap: 64px`; row `padding: 22px 0` | `column-gap: 48px`; row `padding: 15px 0`, `140px 1fr` | Tighter editorial table density |
| **Education** (`.education-card`) | `padding: 20px 0`, `200px 20px 1fr` | `padding: 15px 0`, `180px 18px 1fr` | Matches Experience column alignment seamlessly |
| **Certifications** (`.certificate-gallery`, `.certificate-grid`) | `mt: 52px`, `gap: 22px`, aspect `1.35`, `padding: 18px 20px` | `mt: 36px`, `gap: 16px`, aspect `1.55`, `padding: 14px 16px`; **mobile `<=767px`**: horizontal compact cards (`104px` thumb left + copy right) | Cuts `#education` from `1,822px -> ~1,300px` desktop and **`3,653px -> ~1,200px` mobile** (~2,450px saved!) |
| **Recent Updates** (`#updates`) | `padding: 60px 0 54px`, item `13px 0` | `padding: 44px 0`, item `10px 0` | Keeps 4-item changelog compact and crisp |
| **Contact & Footer** (`#contact`, `.site-footer`) | `padding: 96px 0`, `gap: 5rem` | `padding: 64px 0` (`48px 0` <=767px), `gap: 3.5rem` | Eliminates oversized top/bottom dark padding while preserving a confident close |
| **Dialogs** (`.app-dialog`, `.modal-copy`) | `860px` max, `padding: 30px 32px` | `820px` max, `padding: 24px 26px` (`18px 20px` <=767px) | Keeps modal content visible without excessive inner margins |

---

## 5. Files Requiring Modification (Stage 2 Scope)

Only **3** application files (plus local-only `AGENTS.md` note updates if needed after implementation) will be modified in Stage 2:
1. **`index.html`:**
   - Add zero-FOUC inline theme initialization `<script>` in `<head>` (preserving light default, supporting `localStorage` + `prefers-color-scheme`).
   - Add `<symbol>` definitions for `icon-sun`, `icon-moon`, `icon-monitor` (for the theme toggle).
   - Add `<button type="button" class="theme-toggle" ...>` in `.nav-inner` (accessible label + icon state).
   - Keep all existing content, ChapterWhen Option A presentation, 6 projects, 4 Recent Updates, SEO tags, and WebP `<picture>` elements intact.
2. **`css/style.css`:**
   - Replace hardcoded surface/text values with the complete Light + Dark semantic token system (`:root` / `:root[data-theme="dark"]`, `color-scheme: light dark`).
   - Add dark-mode styling for `.portrait-frame`, screenshots/certificates glare softening, `.theme-toggle`, `<dialog>`, `.toast`, `#contact`, and `.site-footer`.
   - Apply the refined spacing scale, compact hero/section/card proportions, and mobile horizontal `.certificate-card` layout (`<= 767px`).
3. **`js/custom.js`:**
   - Add theme state manager (`getStoredMode`, `resolveTheme`, `applyTheme`, `cycleThemeMode` or Light/Dark/System switching, `localStorage` persistence under `portfolio_theme_v1`, live `prefers-color-scheme` `change` listener, dynamic `<meta name="theme-color">` update, accessible `aria-label` sync).
   - Re-run `measureLayout()` on `themechange` if needed (none expected since theme switches do not change geometry, ensuring zero CLS on theme toggle!).

---

## 6. Implementation & Testing Sequence (Stage 2)

1. **Step 1 — Theme Foundation:** Insert inline `<head>` FOUC-prevention script, SVG sun/moon/monitor symbols, and `.theme-toggle` markup in `index.html`.
2. **Step 2 — Token & Spacing Refactor:** Update `css/style.css` with complete light/dark semantic tokens, dark-theme component rules, `.theme-toggle` styling, and the balanced spacing scale + compact mobile certificate cards.
3. **Step 3 — Theme Controller JS:** Implement `localStorage` persistence, `prefers-color-scheme` live listener, and toggle click handler in `js/custom.js`.
4. **Step 4 — Syntax & Git Hygiene:** Run `node --check js/custom.js`, `git diff --check`, and `git check-ignore AGENTS.md`.
5. **Step 5 — Comprehensive Browser QA (Playwright):**
   - Test **Light theme** (default with empty `localStorage`), **Dark theme** (explicit toggle), **System mode** (with `emulateMedia({ colorScheme: 'dark' })` and `'light'`), and **Reload persistence** (`localStorage` retained, zero FOUC).
   - Inspect **every section, card, dialog (`#modal-chapterwhen`, `#resumeModal`, `#certificate-lightbox`), mobile drawer, copy-email toast, and focus ring** in **both** Light and Dark themes.
   - Verify **zero horizontal overflow** and **measured total heights / density improvements** across `375×812`, `768×1024`, `1024×768`, `1440×900`, and `1920×1080`.
   - Verify **zero console errors/warnings**, **zero failed network requests**, **zero broken images**, and `prefers-reduced-motion: reduce`.
6. **Step 6 — Lighthouse Audits:** Run Lighthouse (Mobile & Desktop) in both Light and Dark states (or verify Accessibility contrast `100` in both!) and report actual measured scores.

---

## 7. Potential Regressions & Prevention

| Potential Regression | Prevention Strategy |
| --- | --- |
| **Flash of Light Theme (FOUC) on dark reload** | Synchronous `<script>` in `<head>` runs before `style.css` parses, setting `data-theme` and `color-scheme` on `<html>` immediately |
| **Layout shift (`CLS`) when toggling themes** | Light and dark themes change only colors/filters/borders—never font weights, sizes, margins, or border widths (`border: 1px solid` kept identically on `.portrait-frame` via `transparent` border in light mode!) |
| **Low contrast in dark mode (`--muted` or `--accent`)** | Selected `#9aa3b2` (`~5.8:1` on `#1d222b`) and `#74a5c0` (`~5.5:1` on `#1d222b`), verified via Lighthouse Accessibility audit |
| **Hero portrait cutout looking harsh on dark canvas** | `.portrait-frame` reserves a `1px solid transparent` border in light mode and reveals subtle dark-slate framing (`var(--surface)` + `var(--line)`) in dark mode |
| **Horizontal certificate cards clipping text on 375px mobile** | Use `min-width: 0` on `.certificate-copy` and fixed `flex: 0 0 100px` thumbnail width so titles wrap cleanly without horizontal overflow |
| **Over-compacting breaking touch targets** | Keep `.button`, `.nav-link`, `.theme-toggle`, `.navbar-toggler`, `.copy-email-btn`, `.contact-social a`, and `.dialog-close` at `>= 40×40px` hit areas |

---

*Stage 1 Complete — Awaiting user review and explicit approval before modifying any application files.*
