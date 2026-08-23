# Paulson J — Portfolio

A fast, responsive portfolio for **Paulson J**, a Java Full Stack Developer and Software Developer. It presents professional experience, selected projects, technical capabilities, education, certifications, and contact details in a recruiter-friendly single-page site.

## Features

- Premium responsive hero with a separate, uncropped portrait
- Accessible sticky navigation, smooth scrolling, visible focus styles, and reduced-motion-friendly interactions
- Project cards with one visual per project and detail modals
- Experience timeline, skill categories, education cards, and certification links
- SEO metadata, Open Graph/Twitter tags, structured data, `robots.txt`, and sitemap
- Static GitHub Pages deployment with no build step

## Tech stack

- HTML5 and CSS3 (custom design system)
- Bootstrap 4 and jQuery for navigation collapse and project modals
- Font Awesome
- GitHub Actions and GitHub Pages

## Run locally

No installation is required. Start a static server from the repository root:

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
├── index.html                 # Content, metadata, and structured data
├── css/style.css              # Responsive design system and component styles
├── js/custom.js               # Navigation and entrance animations
├── img/                       # Portrait and project visuals
├── robots.txt                 # Search-engine crawl rules
├── sitemap.xml                # Canonical page sitemap
└── .github/workflows/         # GitHub Pages deployment workflow
```

## Deployment

The included GitHub Actions workflow deploys to GitHub Pages when changes are pushed to `main`. In the repository settings, set **Pages** to use **GitHub Actions**. The expected public URL is `https://paulson-2004.github.io/portfolio/`.

## License

Distributed under the [MIT License](LICENSE).
