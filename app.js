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

  function normalizePaymentFields() {
    const pan = $("sellerPan");
    const ifsc = $("ifsc");
    const acct = $("acctNumber");
    const upi = $("upi");
    if (pan) pan.value = pan.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    if (ifsc) ifsc.value = ifsc.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
    if (acct) acct.value = acct.value.replace(/\s+/g, "").replace(/\D/g, "").slice(0, 18);
    if (upi) upi.value = upi.value.trim().toLowerCase();
  }

  function clearFieldErrors() {
    form.querySelectorAll(".is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  }

  function markInvalid(id) {
    const el = $(id);
    if (el) el.classList.add("is-invalid");
  }

  function isValidBankName(value) {
    return /^[A-Za-z0-9][A-Za-z0-9 .,&'/-]{1,70}$/.test(value);
  }

  function isValidAccountNumber(value) {
    return /^\d{9,18}$/.test(value);
  }

  function isValidIfsc(value) {
    return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);
  }

  function isValidUpi(value) {
    return /^[a-z0-9](?:[a-z0-9.\-_]{1,255})@[a-z][a-z0-9.\-]{1,63}$/.test(value);
  }

  function isValidPan(value) {
    return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value);
  }

  function isValidAcctName(value) {
    return /^[A-Za-z][A-Za-z .'-]{1,70}$/.test(value);
  }

  function validate() {
    const errors = [];
    clearFieldErrors();

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
        markInvalid(id);
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
      markInvalid("unitRate");
      errors.push("Cost per session must be a valid number.");
    }

    const qty = getQuantity();
    if (qtyMode === "range") {
      if (!$("dateFrom").value || !$("dateTo").value) {
        markInvalid("dateFrom");
        markInvalid("dateTo");
        errors.push("Choose both From and To dates.");
      } else if (qty === null) {
        markInvalid("dateTo");
        errors.push("To date must be on or after From date.");
      }
    } else if (qty === null) {
      markInvalid("qtyManual");
      errors.push("Enter a whole number of sessions / days greater than 0.");
    }

    // Payment / identity format checks once the user has entered enough text
    const pan = $("sellerPan").value.trim().toUpperCase();
    const bankName = $("bankName").value.trim();
    const acctName = $("acctName").value.trim();
    const acctNumber = $("acctNumber").value.replace(/\s+/g, "");
    const ifsc = $("ifsc").value.trim().toUpperCase();
    const upi = $("upi").value.trim().toLowerCase();

    if (pan.length >= 10 && !isValidPan(pan)) {
      markInvalid("sellerPan");
      errors.push("PAN must look like ABCDE1234F (5 letters, 4 digits, 1 letter).");
      if (sellerDetails) sellerDetails.open = true;
    } else if (pan && pan.length < 10) {
      markInvalid("sellerPan");
      errors.push("PAN must be exactly 10 characters (ABCDE1234F).");
      if (sellerDetails) sellerDetails.open = true;
    }

    if (bankName.length >= 2 && !isValidBankName(bankName)) {
      markInvalid("bankName");
      errors.push("Enter a valid bank name (e.g. HDFC Bank).");
      if (sellerDetails) sellerDetails.open = true;
    }

    if (acctName.length >= 2 && !isValidAcctName(acctName)) {
      markInvalid("acctName");
      errors.push("Account name should use letters only (and spaces / . ' -).");
      if (sellerDetails) sellerDetails.open = true;
    }

    if (acctNumber && !isValidAccountNumber(acctNumber)) {
      markInvalid("acctNumber");
      errors.push("Account number must be 9–18 digits (no spaces or letters).");
      if (sellerDetails) sellerDetails.open = true;
    }

    if (ifsc.length >= 11 && !isValidIfsc(ifsc)) {
      markInvalid("ifsc");
      errors.push("IFSC must be 11 characters like HDFC0000053 (4 letters, 0, then 6 alphanumeric).");
      if (sellerDetails) sellerDetails.open = true;
    } else if (ifsc && ifsc.length < 11) {
      markInvalid("ifsc");
      errors.push("IFSC must be exactly 11 characters (e.g. HDFC0000053).");
      if (sellerDetails) sellerDetails.open = true;
    }

    if (upi.includes("@") && !isValidUpi(upi)) {
      markInvalid("upi");
      errors.push("UPI must look like name@okaxis (username@handle).");
      if (sellerDetails) sellerDetails.open = true;
    } else if (upi && !upi.includes("@")) {
      markInvalid("upi");
      errors.push("UPI must include @ (e.g. name@okaxis).");
      if (sellerDetails) sellerDetails.open = true;
    }

    return { ok: errors.length === 0, errors, qty, rate };
  }

  function collect(qty, rate) {
    const amount =
      qty != null && rate != null && Number.isFinite(rate) ? qty * rate : 0;
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
      sellerPan: $("sellerPan").value.trim().toUpperCase(),
      bankName: $("bankName").value.trim(),
      acctName: $("acctName").value.trim(),
      acctNumber: $("acctNumber").value.replace(/\s+/g, ""),
      ifsc: $("ifsc").value.trim().toUpperCase(),
      upi: $("upi").value.trim().toLowerCase(),
    };
  }

  function render() {
    const { ok, errors, qty, rate } = validate();
    const data = collect(qty, rate);

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

  function waitForImages(root) {
    const images = Array.from(root.querySelectorAll("img"));
    return Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      })
    );
  }

  async function downloadPdf() {
    const { ok, errors, qty, rate } = validate();
    if (!ok) {
      formError.hidden = false;
      formError.textContent = errors[0];
      return;
    }

    const html2canvasFn = window.html2canvas;
    const jsPdfCtor = window.jspdf && window.jspdf.jsPDF;
    if (!html2canvasFn || !jsPdfCtor) {
      formError.hidden = false;
      formError.textContent = "PDF library still loading. Try again in a moment.";
      return;
    }

    const data = collect(qty, rate);
    const num = String(data.invoiceNumber).replace("#", "");
    const filename = `Cult Shoots invoice - ${num}.pdf`;

    btnDownload.disabled = true;
    btnDownload.textContent = "Preparing PDF…";

    // Capture a full-size clone at viewport origin (avoids CSS zoom / scroll crop,
    // and avoids Chrome print headers that stamp the site URL).
    const host = document.createElement("div");
    host.className = "pdf-export-host";
    const clone = $("invoice").cloneNode(true);
    clone.id = "invoice-export";
    clone.classList.add("invoice-export");
    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await waitForImages(clone);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const canvas = await html2canvasFn(clone, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: clone.offsetWidth,
        windowHeight: clone.offsetHeight,
      });

      const pdf = new jsPdfCtor({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Force a single A4 page — never call addPage()
      const fit = Math.min(pageW / canvas.width, pageH / canvas.height);
      const imgW = canvas.width * fit;
      const imgH = canvas.height * fit;
      const x = (pageW - imgW) / 2;
      const y = 0;

      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.98),
        "JPEG",
        x,
        y,
        imgW,
        imgH,
        undefined,
        "FAST"
      );
      pdf.save(filename);
    } catch (err) {
      console.error(err);
      formError.hidden = false;
      formError.textContent = "Could not create PDF. Please try again.";
    } finally {
      host.remove();
      btnDownload.textContent = "Download PDF";
      render();
    }
  }

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  form.addEventListener("input", (event) => {
    const id = event.target && event.target.id;
    if (id === "sellerPan" || id === "ifsc" || id === "acctNumber" || id === "upi") {
      normalizePaymentFields();
    }
    saveProfile();
    render();
  });
  form.addEventListener("change", () => {
    normalizePaymentFields();
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
