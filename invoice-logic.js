/**
 * Pure invoice helpers — shared by the app and white-box unit tests.
 * Works in browser (global) and Node (module.exports).
 */
(function (root) {
  "use strict";

  var EXPORT_WIDTH_PX = 794;
  var A4_HEIGHT_PX = Math.round(EXPORT_WIDTH_PX * (297 / 210)); // ~1123

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

  function inclusiveDays(fromValue, toValue) {
    if (!fromValue || !toValue) return null;
    var fromParts = fromValue.split("-").map(Number);
    var toParts = toValue.split("-").map(Number);
    var from = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
    var to = new Date(toParts[0], toParts[1] - 1, toParts[2]);
    var ms = to.setHours(0, 0, 0, 0) - from.setHours(0, 0, 0, 0);
    if (ms < 0) return null;
    return Math.floor(ms / 86400000) + 1;
  }

  function lineAmount(qty, rate) {
    if (!Number.isInteger(qty) || qty <= 0) return null;
    if (!Number.isFinite(rate) || rate < 0) return null;
    return qty * rate;
  }

  function totalAmount(lines) {
    var sum = 0;
    for (var i = 0; i < lines.length; i++) {
      var amt = lineAmount(lines[i].qty, lines[i].rate);
      if (amt != null) sum += amt;
    }
    return sum;
  }

  /**
   * Decide whether PDF export should use 2 pages.
   * Uses fixed A4 width metrics — never phone viewport width.
   */
  function shouldSplitToSecondPage(contentHeightPx, options) {
    options = options || {};
    var a4 = options.a4HeightPx != null ? options.a4HeightPx : A4_HEIGHT_PX;
    var ratio = options.overflowRatio != null ? options.overflowRatio : 1.15;
    var lineCount = options.lineCount != null ? options.lineCount : 0;
    // Short invoices always stay on one page (mobile false-positives)
    if (lineCount > 0 && lineCount <= 6 && contentHeightPx <= a4 * 1.35) {
      return false;
    }
    if (!(contentHeightPx > 0) || !(a4 > 0)) return false;
    return contentHeightPx > a4 * ratio;
  }

  function formatINR(n) {
    return "INR " + Number(n).toLocaleString("en-IN");
  }

  function invoiceNumberDisplay(raw) {
    var cleaned = String(raw || "").trim();
    if (!cleaned) return "#";
    return cleaned.charAt(0) === "#" ? cleaned : "#" + cleaned;
  }

  var api = {
    EXPORT_WIDTH_PX: EXPORT_WIDTH_PX,
    A4_HEIGHT_PX: A4_HEIGHT_PX,
    isValidBankName: isValidBankName,
    isValidAccountNumber: isValidAccountNumber,
    isValidIfsc: isValidIfsc,
    isValidUpi: isValidUpi,
    isValidPan: isValidPan,
    isValidAcctName: isValidAcctName,
    inclusiveDays: inclusiveDays,
    lineAmount: lineAmount,
    totalAmount: totalAmount,
    shouldSplitToSecondPage: shouldSplitToSecondPage,
    formatINR: formatINR,
    invoiceNumberDisplay: invoiceNumberDisplay,
  };

  root.InvoiceLogic = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
