# Paulson J Portfolio

A responsive, single-page portfolio for Paulson J, a Java backend and software developer. The site presents experience, selected projects, technical skills, education, certifications, and contact details.

## Features

- Responsive single-page layout for desktop and mobile devices
- Personal profile and banner photography
- Project filtering and Bootstrap-powered project modals
- Social, email, telephone, and map links
- Search and social metadata, including structured data
- Automated GitHub Pages deployment through GitHub Actions

## Tech stack

- HTML5
- CSS3 and Bootstrap 4
- JavaScript, jQuery, and Bootstrap JavaScript
- Font Awesome and Simple Line Icons
- GitHub Actions and GitHub Pages

## Installation

1. Clone the repository.
2. Change into the project directory.
3. Start a local static web server using one of the commands below.

No package installation is required because all runtime assets are committed to the repository.

## Development commands

Serve the site with Node.js:

```powershell
npx serve .
```

Or serve it with Python:

```powershell
python -m http.server 8000
```

Open the local URL displayed by the server (for example, `http://localhost:3000` or `http://localhost:8000`).

## Build commands

This is a static website and has no compilation or bundling step. Production deployment publishes the repository contents directly, with `index.html` as the entry point.

## Deployment

GitHub Pages is deployed by [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml). On every push to `main`, GitHub Actions uploads the static site and deploys it to GitHub Pages.

To deploy from a fork or a new repository:

1. Push the `main` branch to GitHub.
2. In **Settings → Pages**, set the source to **GitHub Actions** if it is not already selected.
3. Push to `main` or run the **Deploy static content to Pages** workflow manually from the Actions tab.

The deployed site will be available at `https://<owner>.github.io/<repository>/` for project sites.

## Project structure

```text
.
├── index.html                 # Site content and metadata
├── css/                       # Site and vendor stylesheets
├── js/                        # Site and vendor scripts
├── img/                       # Profile, banner, favicon, and project images
├── .github/workflows/         # GitHub Pages deployment workflow
└── docs/                      # Maintenance documentation
```

## License

This project is licensed under the [MIT License](LICENSE).
