# Cult Shoots Invoice Generator

Static invoice website that matches your Sheetal Srinath / Cult Live Shoots invoices.

- Enter a **date range** (inclusive days → quantity) **or** a manual number of sessions
- Enter **cost per session**
- Live **preview** of the invoice
- **Download PDF** (or Print → Save as PDF)

No server, no database, **₹0 hosting**.

## Run locally

Open `index.html` in a browser, or from this folder:

```bash
npx --yes serve .
```

Then visit the URL it prints (usually `http://localhost:3000`).

## Free hosting (GitHub Pages)

1. Create a free GitHub account if you don’t have one.
2. Create a new repository (e.g. `invoice-generation`).
3. Upload everything in this folder **except** `_preview/` and the sample PDFs if you prefer to keep those private.
4. In the repo: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.
5. After a minute, open the Pages URL GitHub shows you.

Anyone with the link can generate invoices. **Your name, PAN, bank, and UPI are not in the hosted source** — you enter them in the form; they are saved only in that browser’s local storage.

## Notes

- Quantity from a date range uses **inclusive calendar days** (1 May–12 May = 12).
- Seller, client, and bank details are editable in the form (client open by default; your details under a collapsed section).
- Signature image: `assets/signature.png` (extracted from your July invoice).
