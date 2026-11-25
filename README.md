# Paulson J — Portfolio

A fast, responsive developer portfolio for **Paulson J**, a Java Full Stack Developer and Software Developer. It presents professional experience, production and full-stack projects (featured by **ChapterWhen**), technical capabilities, education, verified certifications, résumé preview, and contact details in a recruiter-friendly single-page site.

## Features

- Editorial paper-and-ink visual design with Fraunces, Inter, and monospace typography
- Zero-framework static architecture using native HTML `<dialog>`, CSS Grid, inline SVG icons, and progressive-enhancement JavaScript
- Accessible sticky navigation with scroll-progress hairline, smooth scrolling, mobile drawer, visible `:focus-visible` states, and `prefers-reduced-motion` support
- Featured project showcase (**ChapterWhen**) with architecture case-study modal, progressive disclosure across 6 projects, and WebP-optimized visuals
- Experience chronology, aligned full-stack skill rows, balanced education and certification lightbox, lazy-loaded résumé preview, and one-click email copy toast
- SEO metadata, Open Graph/Twitter tags, Schema.org JSON-LD (`Person`), `robots.txt`, and `sitemap.xml` anchored on `https://paulsonj.me/`

## Tech stack

- HTML5 and CSS3 (custom design system, CSS Grid, `@starting-style`)
- Vanilla ES6+ JavaScript (native `<dialog>`, `IntersectionObserver`, Clipboard API)
- Inline SVG icons
- Cloudflare Workers Builds (`https://paulsonj.me/` and `https://portfolio.jpaulson2004.workers.dev/`)

## Run locally

No build step or installation is required. Start a static server from the repository root:

```powershell
npx serve .
```

Or:

```powershell
python -m http.server 8000
```

Open the URL shown by the server, such as `http://localhost:3000` or `http://localhost:8000`.

## Project structure

```text
.
├── index.html                 # Content, SEO metadata, structured data, and native dialogs
├── css/style.css              # Responsive design system, layout, and motion tokens
├── js/custom.js               # Navigation, scroll progress, reveals, dialogs, and toast
├── img/                       # Optimized portrait, résumé preview, certificates, and project visuals
├── docs/                      # Authoritative PDF résumé and planning documentation
├── robots.txt                 # Search-engine crawl rules
└── sitemap.xml                # Canonical page sitemap
```

## Deployment

The portfolio is automatically built and deployed via Cloudflare Workers Builds on pushes to `main`.
- **Primary URL**: `https://paulsonj.me/`
- **Workers URL**: `https://portfolio.jpaulson2004.workers.dev/`

## License

Distributed under the [MIT License](LICENSE).
