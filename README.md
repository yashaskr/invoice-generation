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

## Live site

**https://yashaskr.github.io/invoice-generation/**

Anyone with the link can generate invoices. **Your name, PAN, bank, and UPI are not in the hosted source** — you enter them in the form; they are saved only in that browser’s local storage.

## Notes

- Quantity from a date range uses **inclusive calendar days** (1 May–12 May = 12).
- Seller, client, and bank details are editable in the form (client open by default; your details under a collapsed section).
- Signature image: `assets/signature.png` (extracted from your July invoice).
