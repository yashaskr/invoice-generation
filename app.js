(() => {
  const $ = (id) => document.getElementById(id);

  const PROFILE_KEY = "cult-invoice-profile-v1";
  const PROFILE_FIELDS = [
    "sellerName",
    "sellerAddress",
    "sellerEmail",
    "sellerPhone",
    "sellerPan",
    "bankName",
    "acctName",
    "acctNumber",
    "ifsc",
    "upi",
  ];

  const form = $("invoice-form");
  const modeButtons = document.querySelectorAll(".segment");
  const rangeFields = $("range-fields");
  const manualFields = $("manual-fields");
  const rangeHint = $("range-hint");
  const formError = $("form-error");
  const btnDownload = $("btn-download");
  const btnClearProfile = $("btn-clear-profile");
  const sellerDetails = $("seller-details");
  const previewStatus = $("preview-status");
  const calcQty = $("calc-qty");
  const calcAmount = $("calc-amount");

  let qtyMode = "range";

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      let filled = false;
      for (const id of PROFILE_FIELDS) {
        if (typeof data[id] === "string" && data[id].trim()) {
          $(id).value = data[id];
          filled = true;
        }
      }
      return filled;
    } catch (_) {
      return false;
    }
  }

  function saveProfile() {
    const data = {};
    for (const id of PROFILE_FIELDS) {
      data[id] = $(id).value;
    }
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  }

  function clearProfile() {
    localStorage.removeItem(PROFILE_KEY);
    for (const id of PROFILE_FIELDS) {
      $(id).value = "";
    }
    if (sellerDetails) sellerDetails.open = true;
    render();
  }

  function displaySignName(raw) {
    const name = String(raw || "").trim();
    if (!name) return "";
    // "SHEETAL SRINATH" → "Sheetal Srinath"
    return name
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function setDefaultDates() {
    const today = new Date();
    const issued = $("dateIssued");
    if (!issued.value) {
      issued.value = toInputDate(today);
    }

    const from = $("dateFrom");
    const to = $("dateTo");
    if (!from.value || !to.value) {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      from.value = toInputDate(start);
      to.value = toInputDate(end);
    }
  }

  function toInputDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseLocalDate(value) {
    if (!value) return null;
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatLongDate(value) {
    const d = parseLocalDate(value);
    if (!d) return "—";
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function inclusiveDays(fromValue, toValue) {
    const from = parseLocalDate(fromValue);
    const to = parseLocalDate(toValue);
    if (!from || !to) return null;
    const ms = to.setHours(0, 0, 0, 0) - from.setHours(0, 0, 0, 0);
    if (ms < 0) return null;
    return Math.floor(ms / 86400000) + 1;
  }

  function formatINR(n) {
    return `INR ${Number(n).toLocaleString("en-IN")}`;
  }

  function invoiceNumberDisplay(raw) {
    const cleaned = String(raw || "").trim();
    if (!cleaned) return "#";
    return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
  }

  function getQuantity() {
    if (qtyMode === "manual") {
      const n = Number($("qtyManual").value);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
      return n;
    }
    return inclusiveDays($("dateFrom").value, $("dateTo").value);
  }

  function validate() {
    const errors = [];
    const requiredIds = [
      "invoiceNumber",
      "dateIssued",
      "description",
      "unitRate",
      "clientName",
      "clientAddress",
      ...PROFILE_FIELDS,
    ];

    for (const id of requiredIds) {
      if (!String($(id).value || "").trim()) {
        if (PROFILE_FIELDS.includes(id)) {
          errors.push("Fill your details (name, PAN, bank, UPI) before downloading.");
          if (sellerDetails) sellerDetails.open = true;
        } else {
          errors.push("Please fill all required invoice fields.");
        }
        break;
      }
    }

    const rate = Number($("unitRate").value);
    if (!Number.isFinite(rate) || rate < 0) {
      errors.push("Cost per session must be a valid number.");
    }

    const qty = getQuantity();
    if (qtyMode === "range") {
      if (!$("dateFrom").value || !$("dateTo").value) {
        errors.push("Choose both From and To dates.");
      } else if (qty === null) {
        errors.push("To date must be on or after From date.");
      }
    } else if (qty === null) {
      errors.push("Enter a whole number of sessions / days greater than 0.");
    }

    return { ok: errors.length === 0, errors, qty, rate };
  }

  function collect() {
    const { qty, rate } = validate();
    const amount = qty != null && rate != null ? qty * rate : 0;
    return {
      invoiceNumber: invoiceNumberDisplay($("invoiceNumber").value),
      dateIssued: $("dateIssued").value,
      description: $("description").value.trim(),
      qty,
      rate,
      amount,
      clientName: $("clientName").value.trim(),
      clientAddress: $("clientAddress").value.trim(),
      sellerName: $("sellerName").value.trim(),
      sellerAddress: $("sellerAddress").value.trim(),
      sellerEmail: $("sellerEmail").value.trim(),
      sellerPhone: $("sellerPhone").value.trim(),
      sellerPan: $("sellerPan").value.trim(),
      bankName: $("bankName").value.trim(),
      acctName: $("acctName").value.trim(),
      acctNumber: $("acctNumber").value.trim(),
      ifsc: $("ifsc").value.trim(),
      upi: $("upi").value.trim(),
    };
  }

  function render() {
    const { ok, errors, qty, rate } = validate();
    const data = collect();

    calcQty.textContent = qty != null ? String(qty) : "—";
    calcAmount.textContent =
      qty != null && Number.isFinite(rate) ? formatINR(qty * rate) : "INR 0";

    if (qtyMode === "range" && qty != null) {
      rangeHint.textContent = `${qty} inclusive calendar day${qty === 1 ? "" : "s"} → quantity.`;
    } else if (qtyMode === "range") {
      rangeHint.textContent = "Inclusive calendar days become the quantity.";
    }

    $("pv-seller-name").textContent = data.sellerName || "YOUR NAME";
    $("pv-seller-address").textContent = data.sellerAddress || "";
    $("pv-seller-email").textContent = data.sellerEmail || "";
    $("pv-seller-phone").textContent = data.sellerPhone || "";
    $("pv-seller-pan").textContent = data.sellerPan || "—";
    $("pv-sign-name").textContent = displaySignName(data.sellerName);
    $("pv-invoice-number").textContent = data.invoiceNumber;
    $("pv-date-issued").textContent = formatLongDate(data.dateIssued);
    $("pv-client-name").textContent = data.clientName || "—";
    $("pv-client-address").textContent = data.clientAddress || "";
    $("pv-description").textContent = data.description || "—";
    $("pv-qty").textContent = qty != null ? String(qty) : "—";
    $("pv-rate").textContent = Number.isFinite(rate) ? formatINR(rate) : "—";
    $("pv-line-amount").textContent =
      qty != null && Number.isFinite(rate) ? formatINR(qty * rate) : "—";
    $("pv-total").textContent =
      qty != null && Number.isFinite(rate) ? formatINR(qty * rate) : "INR 0";
    $("pv-bank").textContent = data.bankName || "";
    $("pv-acct-name").textContent = data.acctName || "";
    $("pv-acct-number").textContent = data.acctNumber || "";
    $("pv-ifsc").textContent = data.ifsc || "";
    $("pv-upi").textContent = data.upi || "";
    $("pv-footer-email").textContent = data.sellerEmail || "";
    $("pv-footer-phone").textContent = data.sellerPhone || "";

    btnDownload.disabled = !ok;
    if (ok) {
      formError.hidden = true;
      previewStatus.textContent = "Ready to download";
      previewStatus.classList.remove("warn");
      previewStatus.classList.add("ok");
    } else {
      previewStatus.textContent = errors[0] || "Complete the form to enable download";
      previewStatus.classList.add("warn");
      previewStatus.classList.remove("ok");
    }
  }

  function setMode(mode) {
    qtyMode = mode;
    modeButtons.forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
    rangeFields.classList.toggle("hidden", mode !== "range");
    manualFields.classList.toggle("hidden", mode !== "manual");
    render();
  }

  function buildPrintDocument(filename, styleCss, invoiceHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${filename}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Sans:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
${styleCss}
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
    }
    body {
      display: flex;
      justify-content: center;
    }
    .invoice {
      box-shadow: none !important;
      zoom: 1 !important;
      transform: none !important;
      margin: 0 !important;
      width: 210mm !important;
      min-height: 297mm !important;
    }
    @page {
      size: A4;
      margin: 0;
    }
    @media print {
      html, body {
        width: 210mm;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .invoice {
        width: 210mm !important;
        min-height: 297mm !important;
      }
    }
  </style>
</head>
<body>
  ${invoiceHtml}
</body>
</html>`;
  }

  async function waitForPrintReady(doc) {
    if (doc.fonts && doc.fonts.ready) {
      try {
        await doc.fonts.ready;
      } catch (_) {
        /* ignore */
      }
    }
    const images = Array.from(doc.images || []);
    await Promise.all(
      images.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = img.onerror = resolve;
        });
      })
    );
    await new Promise((r) => setTimeout(r, 250));
  }

  async function downloadPdf() {
    const { ok, errors } = validate();
    if (!ok) {
      formError.hidden = false;
      formError.textContent = errors[0];
      return;
    }

    const data = collect();
    const num = String(data.invoiceNumber).replace("#", "");
    const filename = `Cult Shoots invoice - ${num}`;

    btnDownload.disabled = true;
    btnDownload.textContent = "Opening…";

    let iframe = null;

    try {
      // Inline CSS + sandboxed iframe so Chrome extensions can't inject
      // widgets into the printed document.
      const styleCss = await fetch(new URL("styles.css", window.location.href)).then((r) =>
        r.text()
      );
      const invoiceHtml = $("invoice").outerHTML.replace(
        /src="(assets\/[^"]+)"/g,
        (_, path) => `src="${new URL(path, window.location.href).href}"`
      );
      const html = buildPrintDocument(filename, styleCss, invoiceHtml);

      iframe = document.createElement("iframe");
      iframe.setAttribute(
        "sandbox",
        "allow-modals allow-same-origin allow-scripts"
      );
      iframe.setAttribute("title", "Invoice print");
      iframe.style.cssText =
        "position:fixed;width:210mm;height:297mm;left:-10000px;top:0;border:0;opacity:0;pointer-events:none;";
      document.body.appendChild(iframe);

      const loaded = new Promise((resolve, reject) => {
        iframe.onload = () => resolve();
        iframe.onerror = () => reject(new Error("Print frame failed to load"));
        setTimeout(() => resolve(), 1500);
      });
      iframe.srcdoc = html;
      await loaded;
      await waitForPrintReady(iframe.contentDocument);

      const frameWindow = iframe.contentWindow;
      const cleanup = () => {
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
        iframe = null;
      };
      frameWindow.addEventListener("afterprint", cleanup, { once: true });
      setTimeout(cleanup, 60_000);

      frameWindow.focus();
      frameWindow.print();
    } catch (err) {
      console.error(err);
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      formError.hidden = false;
      formError.textContent = "Could not prepare the PDF. Please try again.";
    } finally {
      btnDownload.textContent = "Download PDF";
      render();
    }
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  form.addEventListener("input", () => {
    saveProfile();
    render();
  });
  form.addEventListener("change", () => {
    saveProfile();
    render();
  });
  btnDownload.addEventListener("click", downloadPdf);
  btnClearProfile.addEventListener("click", clearProfile);

  const hadProfile = loadProfile();
  if (sellerDetails) sellerDetails.open = !hadProfile;
  setDefaultDates();
  render();
})();
