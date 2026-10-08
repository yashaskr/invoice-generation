# Invoice Generator

Static invoice website — enter services, quantities, and rates, preview, then download a PDF.

Works for any client or service type (not tied to a single brand). No server, no database, **₹0 hosting**.

## Live site

**https://yashaskr.github.io/invoice-generation/**

## Run locally

Open `index.html` in a browser, or from this folder:

```bash
npx --yes serve .
```

## Tests

```bash
npm install
npm test
```

See [TESTING.md](TESTING.md) for white-box unit tests and Playwright E2E (desktop / mobile).

## Notes

- Add one or more service line items; total = sum of qty × rate.
- Optional helper can set the first line’s qty from an inclusive date range.
- Your name, PAN, bank, and UPI are entered in the form and saved only in that browser’s local storage — not in the hosted source.
- Signature image: `assets/signature.png` (replace with your own if needed).
