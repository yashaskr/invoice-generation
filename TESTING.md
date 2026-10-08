# Testing

## White-box (unit)

Pure logic in `invoice-logic.js` (validation, totals, PDF page-split rules).

```bash
npm run test:unit
```

## Black-box (E2E)

Playwright covers Chromium, WebKit, Firefox, Pixel 7, and iPhone 14 viewports.

```bash
# Recommended stable suite (Chromium desktop + mobile Chrome)
npm run test:e2e

# All configured browsers / devices
npm run test:e2e:all
```

First-time setup:

```bash
npm install
set PLAYWRIGHT_BROWSERS_PATH=0
npx playwright install
```

## What is asserted

- UI loads; add service works
- Multi-line qty × rate totals
- Payment validation gates download
- Profile persistence via `localStorage`
- Short invoices download as **1-page** PDFs (desktop + mobile)
- Date-range helper applies qty to first line
- Mobile preview starts collapsed (tap to expand)
