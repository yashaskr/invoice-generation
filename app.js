(function () {
  "use strict";

  // ---- Cross-browser helpers (Safari / Chrome / Firefox / Edge / Samsung) ----
  if (!Element.prototype.matches) {
    Element.prototype.matches =
      Element.prototype.msMatchesSelector ||
      Element.prototype.webkitMatchesSelector;
  }
  if (!Element.prototype.closest) {
    Element.prototype.closest = function (sel) {
      var el = this;
      while (el && el.nodeType === 1) {
        if (el.matches(sel)) return el;
        el = el.parentElement || el.parentNode;
      }
      return null;
    };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  function storageRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      /* ignore */
    }
  }

  function isMobileLayout() {
    try {
      return !!(window.matchMedia && window.matchMedia("(max-width: 1100px)").matches);
    } catch (e) {
      return window.innerWidth <= 1100;
    }
  }

  function bindTap(el, handler) {
    if (!el) return;
    // Single path for all browsers — avoid touchend+click double-firing
    el.addEventListener("click", function (event) {
      if (event && event.preventDefault) event.preventDefault();
      if (event && event.stopPropagation) event.stopPropagation();
      handler(event);
    });
  }

  const PROFILE_KEY = "cult-invoice-profile-v1";
  const LINES_KEY = "cult-invoice-lines-v1";
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
  const lineItemsEl = $("line-items");
  const rangeHint = $("range-hint");
  const formError = $("form-error");
  const btnDownload = $("btn-download");
  const btnClearProfile = $("btn-clear-profile");
  const btnAddLine = $("btn-add-line");
  const btnApplyRange = $("btn-apply-range");
  const sellerDetails = $("seller-details");
  const previewStatus = $("preview-status");
  const calcQty = $("calc-qty");
  const calcAmount = $("calc-amount");
  const pvLines = $("pv-lines");

  let lineSeq = 0;
  let addLockUntil = 0;

  function loadProfile() {
    try {
      const raw = storageGet(PROFILE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      let filled = false;
      for (let i = 0; i < PROFILE_FIELDS.length; i++) {
        const id = PROFILE_FIELDS[i];
        if (typeof data[id] === "string" && data[id].trim()) {
          $(id).value = data[id];
          filled = true;
        }
      }
      return filled;
    } catch (e) {
      return false;
    }
  }

  function saveProfile() {
    const data = {};
    for (let i = 0; i < PROFILE_FIELDS.length; i++) {
      const id = PROFILE_FIELDS[i];
      data[id] = $(id).value;
    }
    storageSet(PROFILE_KEY, JSON.stringify(data));
  }

  function clearProfile() {
    storageRemove(PROFILE_KEY);
    for (let i = 0; i < PROFILE_FIELDS.length; i++) {
      $(PROFILE_FIELDS[i]).value = "";
    }
    if (sellerDetails) sellerDetails.open = true;
    render();
  }

  function saveLines() {
    const payload = readLinesFromDom().map(function (line) {
      return {
        description: line.description,
        qty: line.qty,
        rate: line.rate,
        amount: line.amount,
      };
    });
    storageSet(LINES_KEY, JSON.stringify(payload));
  }

  function loadLines() {
    try {
      const raw = storageGet(LINES_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!Array.isArray(data) || !data.length) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function displaySignName(raw) {
    const name = String(raw || "").trim();
    if (!name) return "";
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

  function createLineCard(line) {
    line = line || {};
    const qtyVal = line.qty != null ? line.qty : 1;
    const rateVal = line.rate != null ? line.rate : 1300;
    const id = "line-" + ++lineSeq;
    const card = document.createElement("div");
    card.className = "line-item";
    card.setAttribute("data-line-id", id);
    card.innerHTML =
      '<div class="line-item-head">' +
      '<span class="line-item-title">Service</span>' +
      '<button type="button" class="btn-text btn-remove-line">Remove</button>' +
      "</div>" +
      "<label>Description of services" +
      '<input type="text" class="line-desc" value="' +
      escapeAttr(line.description || "") +
      '" placeholder="e.g. Live shoots, consulting, editing" required /></label>' +
      '<div class="row row-3">' +
      "<label>Qty" +
      '<input type="number" class="line-qty" min="1" step="1" value="' +
      escapeAttr(String(qtyVal)) +
      '" required /></label>' +
      "<label>Unit rate (INR)" +
      '<input type="number" class="line-rate" min="0" step="1" value="' +
      escapeAttr(String(rateVal)) +
      '" required /></label>' +
      "<label>Amount" +
      '<input type="text" class="line-amount" value="—" readonly tabindex="-1" /></label>' +
      "</div>";
    return card;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function readLinesFromDom() {
    return qsa(".line-item", lineItemsEl).map(function (card) {
      const description = qs(".line-desc", card).value.trim();
      const qty = Number(qs(".line-qty", card).value);
      const rate = Number(qs(".line-rate", card).value);
      const amount =
        Number.isInteger(qty) && qty > 0 && Number.isFinite(rate) && rate >= 0
          ? qty * rate
          : null;
      return { description: description, qty: qty, rate: rate, amount: amount, el: card };
    });
  }

  function renumberLines() {
    const cards = lineItemsEl.querySelectorAll(".line-item");
    cards.forEach((card, index) => {
      card.querySelector(".line-item-title").textContent = `Service ${index + 1}`;
      const removeBtn = card.querySelector(".btn-remove-line");
      removeBtn.hidden = cards.length <= 1;
    });
  }

  function addLine(line) {
    const card = createLineCard(line);
    lineItemsEl.appendChild(card);
    renumberLines();
    updateLineAmounts();
  }

  function updateLineAmounts() {
    readLinesFromDom().forEach((line) => {
      const amountInput = line.el.querySelector(".line-amount");
      amountInput.value =
        line.amount != null ? formatINR(line.amount) : "—";
    });
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
    qsa(".is-invalid", form).forEach(function (el) {
      el.className = el.className.replace(/\bis-invalid\b/g, "").replace(/\s+/g, " ").trim();
    });
  }

  function markInvalid(elOrId) {
    const el = typeof elOrId === "string" ? $(elOrId) : elOrId;
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

    const requiredIds = ["invoiceNumber", "dateIssued", "clientName", "clientAddress", ...PROFILE_FIELDS];

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

    const lines = readLinesFromDom();
    if (!lines.length) {
      errors.push("Add at least one service line.");
    }

    lines.forEach((line, index) => {
      if (!line.description) {
        markInvalid(line.el.querySelector(".line-desc"));
        errors.push(`Service ${index + 1}: enter a description.`);
      }
      if (!Number.isInteger(line.qty) || line.qty <= 0) {
        markInvalid(line.el.querySelector(".line-qty"));
        errors.push(`Service ${index + 1}: qty must be a whole number greater than 0.`);
      }
      if (!Number.isFinite(line.rate) || line.rate < 0) {
        markInvalid(line.el.querySelector(".line-rate"));
        errors.push(`Service ${index + 1}: enter a valid unit rate.`);
      }
    });

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

    const total = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
    const totalQty = lines.reduce(
      (sum, line) => sum + (Number.isInteger(line.qty) && line.qty > 0 ? line.qty : 0),
      0
    );

    return { ok: errors.length === 0, errors, lines, total, totalQty };
  }

  function collect(lines, total) {
    return {
      invoiceNumber: invoiceNumberDisplay($("invoiceNumber").value),
      dateIssued: $("dateIssued").value,
      lines: lines.map(({ description, qty, rate, amount }) => ({
        description,
        qty,
        rate,
        amount,
      })),
      total,
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

  function renderPreviewLines(lines) {
    pvLines.innerHTML = "";
    if (!lines.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>—</td><td>—</td><td>—</td><td>—</td>";
      pvLines.appendChild(tr);
      return;
    }

    lines.forEach((line) => {
      const tr = document.createElement("tr");
      const qtyOk = Number.isInteger(line.qty) && line.qty > 0;
      const rateOk = Number.isFinite(line.rate) && line.rate >= 0;
      tr.innerHTML = `
        <td>${escapeHtml(line.description || "—")}</td>
        <td>${qtyOk ? String(line.qty) : "—"}</td>
        <td>${rateOk ? formatINR(line.rate) : "—"}</td>
        <td>${line.amount != null ? formatINR(line.amount) : "—"}</td>
      `;
      pvLines.appendChild(tr);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    updateLineAmounts();
    const { ok, errors, lines, total, totalQty } = validate();
    const data = collect(lines, total);

    calcQty.textContent = String(lines.length);
    calcAmount.textContent = formatINR(total || 0);

    const rangeDays = inclusiveDays($("dateFrom").value, $("dateTo").value);
    if (rangeDays != null) {
      rangeHint.textContent = `${rangeDays} inclusive calendar day${rangeDays === 1 ? "" : "s"} — click Apply to set first service qty.`;
    } else {
      rangeHint.textContent = "Inclusive calendar days.";
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
    renderPreviewLines(lines);
    $("pv-total").textContent = formatINR(total || 0);
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
      previewStatus.textContent = `Ready to download · ${lines.length} line${lines.length === 1 ? "" : "s"} · ${totalQty} qty`;
      previewStatus.classList.remove("warn");
      previewStatus.classList.add("ok");
    } else {
      previewStatus.textContent = errors[0] || "Complete the form to enable download";
      previewStatus.classList.add("warn");
      previewStatus.classList.remove("ok");
    }
  }

  function waitForImages(root) {
    const images = qsa("img", root);
    return Promise.all(
      images.map(function (img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(function (resolve) {
          img.onload = function () {
            resolve();
          };
          img.onerror = function () {
            resolve();
          };
        });
      })
    );
  }

  var EXPORT_WIDTH_PX = 794;
  var A4_HEIGHT_PX = Math.round(EXPORT_WIDTH_PX * (297 / 210)); // ~1123

  async function captureElement(html2canvasFn, el) {
    // Pin size so mobile viewports cannot change the capture
    el.style.width = EXPORT_WIDTH_PX + "px";
    el.style.maxWidth = EXPORT_WIDTH_PX + "px";
    el.style.minWidth = EXPORT_WIDTH_PX + "px";
    el.style.height = "auto";
    el.style.minHeight = "0";
    el.style.transform = "none";

    return html2canvasFn(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: EXPORT_WIDTH_PX,
      windowWidth: EXPORT_WIDTH_PX,
      windowHeight: Math.max(el.scrollHeight, el.offsetHeight, 1),
    });
  }

  function addCanvasAsSinglePage(pdf, canvas, pageW, pageH) {
    // Always one image → one PDF page (shrink to fit A4)
    var scale = Math.min(pageW / canvas.width, pageH / canvas.height);
    var imgW = canvas.width * scale;
    var imgH = canvas.height * scale;
    var x = (pageW - imgW) / 2;
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.98),
      "JPEG",
      x,
      0,
      imgW,
      imgH,
      undefined,
      "FAST"
    );
  }

  function forceExportLayout(el) {
    el.style.cssText =
      "width:" +
      EXPORT_WIDTH_PX +
      "px !important;max-width:" +
      EXPORT_WIDTH_PX +
      "px !important;min-width:" +
      EXPORT_WIDTH_PX +
      "px !important;min-height:0 !important;height:auto !important;transform:none !important;margin:0 !important;box-shadow:none !important;";
  }

  async function downloadPdf() {
    const { ok, errors, lines, total } = validate();
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

    const data = collect(lines, total);
    const num = String(data.invoiceNumber).replace("#", "");
    const filename = "Invoice-" + num + ".pdf";

    btnDownload.disabled = true;
    btnDownload.textContent = "Preparing PDF…";

    const host = document.createElement("div");
    host.className = "pdf-export-host";
    const clone = $("invoice").cloneNode(true);
    clone.id = "invoice-export";
    clone.classList.add("invoice-export");
    forceExportLayout(clone);
    host.appendChild(clone);
    document.body.appendChild(host);

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await waitForImages(clone);
      await new Promise(function (r) {
        requestAnimationFrame(function () {
          requestAnimationFrame(r);
        });
      });

      const pdf = new jsPdfCtor({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Measure at fixed A4 width only (phone width was falsely triggering page 2)
      forceExportLayout(clone);
      var contentHeight = Math.max(clone.scrollHeight, clone.offsetHeight);
      var closing = clone.querySelector(".inv-closing");
      // Only split when clearly taller than one A4 (~15% overflow), not tiny rounding
      var needsSecondPage =
        !!closing && contentHeight > A4_HEIGHT_PX * 1.15;

      if (!needsSecondPage) {
        var note = clone.querySelector(".inv-continue-note");
        if (note && note.parentNode) note.parentNode.removeChild(note);
        var canvas = await captureElement(html2canvasFn, clone);
        addCanvasAsSinglePage(pdf, canvas, pageW, pageH);
      } else {
        clone.classList.add("invoice-page1");
        var page2 = document.createElement("article");
        page2.className = "invoice invoice-export invoice-page2";
        page2.innerHTML =
          '<div class="inv-topbar"></div>' +
          '<header class="inv-page2-header">' +
          "<div>" +
          "<h2></h2>" +
          '<p class="muted page2-client"></p>' +
          "</div>" +
          '<div class="inv-page2-meta">' +
          '<p class="page-label">Page 2 of 2 · Continued</p>' +
          '<p class="inv-number"></p>' +
          '<p class="inv-date">Date Issued: <strong></strong></p>' +
          "</div>" +
          "</header>";
        forceExportLayout(page2);

        var h2 = qs("h2", page2);
        var clientEl = qs(".page2-client", page2);
        var numEl = qs(".inv-number", page2);
        var dateEl = qs(".inv-date strong", page2);
        if (h2) h2.textContent = data.sellerName || "INVOICE";
        if (clientEl) {
          clientEl.textContent = data.clientName
            ? "Billed to: " + data.clientName
            : "";
        }
        if (numEl) numEl.textContent = data.invoiceNumber;
        if (dateEl) dateEl.textContent = formatLongDate(data.dateIssued);

        page2.appendChild(closing);
        host.appendChild(page2);

        await waitForImages(page2);
        await new Promise(function (r) {
          requestAnimationFrame(function () {
            requestAnimationFrame(r);
          });
        });

        var canvas1 = await captureElement(html2canvasFn, clone);
        addCanvasAsSinglePage(pdf, canvas1, pageW, pageH);

        pdf.addPage();
        var canvas2 = await captureElement(html2canvasFn, page2);
        addCanvasAsSinglePage(pdf, canvas2, pageW, pageH);
      }

      // Ensure we never accidentally leave blank trailing pages
      pdf.save(filename);
    } catch (err) {
      if (window.console && console.error) console.error(err);
      formError.hidden = false;
      formError.textContent = "Could not create PDF. Please try again.";
    } finally {
      if (host && host.parentNode) host.parentNode.removeChild(host);
      btnDownload.textContent = "Download PDF";
      render();
    }
  }

  function applyRangeToFirstLine() {
    const days = inclusiveDays($("dateFrom").value, $("dateTo").value);
    const firstQty = lineItemsEl.querySelector(".line-item .line-qty");
    if (days == null) {
      formError.hidden = false;
      formError.textContent = "Choose a valid From/To date range first.";
      markInvalid("dateFrom");
      markInvalid("dateTo");
      return;
    }
    if (!firstQty) return;
    firstQty.value = String(days);
    saveLines();
    render();
  }

  function handleRemoveLine(event) {
    const target = event.target || event.srcElement;
    if (!target || !target.closest) return;
    const removeBtn = target.closest(".btn-remove-line");
    if (!removeBtn) return;
    if (event.preventDefault) event.preventDefault();
    const card = removeBtn.closest(".line-item");
    if (!card) return;
    if (qsa(".line-item", lineItemsEl).length <= 1) return;
    if (card.parentNode) card.parentNode.removeChild(card);
    renumberLines();
    saveLines();
    render();
  }

  function handleAddLine(event) {
    if (event && event.preventDefault) event.preventDefault();

    const now = Date.now();
    if (now < addLockUntil) return;
    addLockUntil = now + 350;

    try {
      addLine({ description: "", qty: 1, rate: 1300 });
      saveLines();
      render();
    } catch (err) {
      if (window.console && console.error) console.error(err);
      formError.hidden = false;
      formError.textContent = "Could not add a service line. Please refresh and try again.";
      return;
    }

    const cards = qsa(".line-item", lineItemsEl);
    const lastCard = cards[cards.length - 1];
    if (lastCard) {
      lastCard.className += " line-item-flash";
      if (lastCard.scrollIntoView) {
        try {
          lastCard.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (e) {
          lastCard.scrollIntoView(true);
        }
      }
      const last = qs(".line-desc", lastCard);
      setTimeout(function () {
        if (last && last.focus) last.focus();
      }, 120);
    }
  }

  // One global entry point used by button binding (all browsers)
  window.__addInvoiceLine = handleAddLine;

  bindTap(btnAddLine, handleAddLine);
  bindTap(btnApplyRange, applyRangeToFirstLine);
  bindTap(btnDownload, downloadPdf);
  bindTap(btnClearProfile, clearProfile);
  if (lineItemsEl) {
    lineItemsEl.addEventListener("click", handleRemoveLine);
  }

  // On phones/tablets, keep preview collapsed so it cannot cover controls
  const previewPanel = $("preview-panel");
  if (previewPanel && isMobileLayout()) {
    previewPanel.open = false;
  }

  if (form) {
    form.addEventListener("input", function (event) {
      const target = event.target || event.srcElement;
      const id = target && target.id;
      if (id === "sellerPan" || id === "ifsc" || id === "acctNumber" || id === "upi") {
        normalizePaymentFields();
      }
      if (target && target.closest && target.closest(".line-item")) {
        updateLineAmounts();
        saveLines();
      }
      saveProfile();
      render();
    });

    form.addEventListener("change", function () {
      normalizePaymentFields();
      saveProfile();
      saveLines();
      render();
    });
  }

  const savedLines = loadLines();
  if (savedLines) {
    for (let i = 0; i < savedLines.length; i++) {
      addLine(savedLines[i]);
    }
  } else {
    addLine({ description: "", qty: 1, rate: 0 });
  }

  const hadProfile = loadProfile();
  if (sellerDetails) sellerDetails.open = !hadProfile;
  setDefaultDates();
  render();
})();
