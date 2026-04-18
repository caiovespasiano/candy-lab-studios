# Candy Lab Studios

Premium portfolio landing page for 3D assets and Roblox UGC items, with a private admin panel,
local persistence API, and secure content management flow.

## Overview

This project combines a public-facing landing page and a protected admin experience in the same
codebase. The admin panel supports article creation, editing, publishing, image uploads,
drag-and-drop ordering, and project-level persistence.

The implementation follows the project governance rules in [.github/project-governance.config.js](.github/project-governance.config.js)
and architecture requirements documented in:

- [docs/dimi3d-requirements-specification.md](docs/dimi3d-requirements-specification.md)
- [docs/dimi3d-architecture-manifesto.md](docs/dimi3d-architecture-manifesto.md)

## Tech Stack

- React 19
- Vite 8
- Tailwind CSS 4
- JavaScript (ES Modules)
- Framer Motion (drag-and-drop reorder)
- Vitest + Testing Library
- Node.js HTTP server for production API serving

## Key Features

### Public Landing Page

- Brand-focused hero section
- Responsive portfolio gallery
- Modal gallery with image carousel and dimensions handling
- Session-based like system
- Social section and sanitized contact form flow
- Multilanguage labels (PT-BR, ES, EN)
- Configurable global background color

### Admin Panel

- Protected login (username, password, verification code)
- Session validation using secure HTTP-only cookies
- CRUD operations for article catalog
- Publish/hide toggle
- Drag-and-drop reorder
- Main image and gallery image upload flow
- Persisted article catalog and media files

## Security Model

- Input sanitization for text and URL fields
- XSS prevention by treating all incoming input as untrusted
- Centralized HTTP error mapping with sanitized messages
- Security headers (CSP in preview/production contexts)
- Session token expiration and server-side validation
- Rate limiting for authentication and admin API traffic

## Project Structure

```text
server/
  index.js                            # Production HTTP server + API routes
  adminAuthenticationDataService.js   # Admin auth/session logic
  apiRateLimitService.js              # Route-aware rate limiting
  projectPersistenceDataService.js    # Disk persistence + upload handling

src/
  App.jsx                             # Landing page shell + route switch
  components/
    AdminAccessPanel.jsx              # Private admin interface
  constants/                          # Global config/catalog/translations
  controllers/                        # Domain operations (article publication)
  models/                             # Entity creation/validation
  repositories/                       # Runtime/local storage abstractions
  security/                           # Sanitization helpers
  services/                           # Gateway/session/background services
  tests/                              # Unit tests

data/
  articles.json                       # Persisted article catalog

public/
  uploads/                            # Uploaded images
```

## Prerequisites

- Node.js 20+
- npm 10+

## Environment Variables

Create a local .env file based on [.env.example](.env.example) and configure admin credentials.

Required variables:

- VITE_ADMIN_USERNAME
- VITE_ADMIN_PASSWORD
- VITE_ADMIN_VERIFICATION_CODE
- VITE_ADMIN_SESSION_SECRET

Example:

```dotenv
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=YourStrongPassword
VITE_ADMIN_VERIFICATION_CODE=your2faCode
VITE_ADMIN_SESSION_SECRET=replace_with_long_random_secret
```

## Installation

```bash
npm install
```

## Available Scripts

- npm run dev: Starts Vite dev server with local API middleware
- npm run dev:server: Starts standalone Node server (production-like API serving)
- npm run build: Builds client bundle into dist
- npm run preview: Serves built assets using Vite preview
- npm run start: Starts Node production server
- npm run lint: Runs ESLint
- npm run test: Runs Vitest in run mode
- npm run test:watch: Runs Vitest in watch mode

## Running in Development

```bash
npm run dev
```

In development, /api routes are handled by Vite middleware. Admin content persistence writes to:

- [data/articles.json](data/articles.json)
- [public/uploads/](public/uploads)

The Vite watcher is configured to ignore these persistence paths to avoid full-page reload while
reordering/saving content through the admin panel.

## Running Production Locally

```bash
npm run build
npm run start
```

Production server behavior:

- Serves frontend from dist
- Serves local API endpoints under /api
- Serves uploaded media from /uploads

## Local API Endpoints

- POST /api/admin/authenticate
- GET /api/admin/session
- POST /api/admin/logout
- GET /api/admin/articles
- POST /api/admin/articles
- POST /api/admin/upload-image

## Testing

Run all tests:

```bash
npm run test
```

Run focused suites:

```bash
npm run test -- src/tests/apiRateLimitService.test.js src/tests/projectPersistenceGatewayService.test.js
```

## Branching Strategy

- candylabstudios: primary working branch
- develop: integration branch
- master: production branch

## Troubleshooting

### Admin reorder appears to refresh the page in development

Restart npm run dev after pulling recent changes so the updated Vite watch ignore rules are active.

### Too many GET requests / 429 in the admin panel

- Confirm dev server was restarted
- Hard-refresh the browser
- Check that catalog bootstrap is not duplicated by stale HMR state

### Authentication works in env file but fails at runtime

Ensure .env is present at project root and restart both dev and server processes after changes.

## License

Private project. All rights reserved unless otherwise specified by the repository owner.
