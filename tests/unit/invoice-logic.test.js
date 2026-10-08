const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const Logic = require("../../invoice-logic.js");

describe("white-box: payment validation", () => {
  test("PAN accepts valid format", () => {
    assert.equal(Logic.isValidPan("FXJPS7605L"), true);
    assert.equal(Logic.isValidPan("ABCDE1234F"), true);
  });

  test("PAN rejects invalid format", () => {
    assert.equal(Logic.isValidPan("FXJPS7605"), false);
    assert.equal(Logic.isValidPan("fxjps7605l"), false);
    assert.equal(Logic.isValidPan("1234567890"), false);
  });

  test("IFSC accepts valid format", () => {
    assert.equal(Logic.isValidIfsc("HDFC0000053"), true);
    assert.equal(Logic.isValidIfsc("SBIN0001234"), true);
  });

  test("IFSC rejects invalid format", () => {
    assert.equal(Logic.isValidIfsc("HDFC000053"), false);
    assert.equal(Logic.isValidIfsc("hdfc0000053"), false);
    assert.equal(Logic.isValidIfsc("HDFC1000053"), false);
  });

  test("account number 9–18 digits", () => {
    assert.equal(Logic.isValidAccountNumber("50100209350007"), true);
    assert.equal(Logic.isValidAccountNumber("123456789"), true);
    assert.equal(Logic.isValidAccountNumber("12345678"), false);
    assert.equal(Logic.isValidAccountNumber("50100209350007A"), false);
  });

  test("UPI format", () => {
    assert.equal(Logic.isValidUpi("sheetalsrinath-1@okaxis"), true);
    assert.equal(Logic.isValidUpi("name@upi"), true);
    assert.equal(Logic.isValidUpi("nameokaxis"), false);
    assert.equal(Logic.isValidUpi("@okaxis"), false);
  });

  test("bank name", () => {
    assert.equal(Logic.isValidBankName("HDFC Bank"), true);
    assert.equal(Logic.isValidBankName("State Bank of India"), true);
    assert.equal(Logic.isValidBankName(""), false);
    assert.equal(Logic.isValidBankName("!!!"), false);
  });
});

describe("white-box: calculations", () => {
  test("inclusive days", () => {
    assert.equal(Logic.inclusiveDays("2026-05-01", "2026-05-12"), 12);
    assert.equal(Logic.inclusiveDays("2026-05-01", "2026-05-01"), 1);
    assert.equal(Logic.inclusiveDays("2026-05-12", "2026-05-01"), null);
  });

  test("line and total amounts", () => {
    assert.equal(Logic.lineAmount(12, 1300), 15600);
    assert.equal(Logic.lineAmount(0, 1300), null);
    assert.equal(
      Logic.totalAmount([
        { qty: 12, rate: 1300 },
        { qty: 2, rate: 500 },
      ]),
      16600
    );
  });

  test("invoice number display", () => {
    assert.equal(Logic.invoiceNumberDisplay("3"), "#3");
    assert.equal(Logic.invoiceNumberDisplay("#003"), "#003");
  });
});

describe("white-box: PDF page split decision", () => {
  test("short content stays on one page", () => {
    assert.equal(
      Logic.shouldSplitToSecondPage(900, { lineCount: 1 }),
      false
    );
    assert.equal(
      Logic.shouldSplitToSecondPage(Logic.A4_HEIGHT_PX, { lineCount: 2 }),
      false
    );
    assert.equal(
      Logic.shouldSplitToSecondPage(Logic.A4_HEIGHT_PX * 1.2, {
        lineCount: 3,
      }),
      false
    );
  });

  test("very tall content with many lines can split", () => {
    assert.equal(
      Logic.shouldSplitToSecondPage(Logic.A4_HEIGHT_PX * 1.5, {
        lineCount: 12,
      }),
      true
    );
  });

  test("export width constants are A4-based", () => {
    assert.equal(Logic.EXPORT_WIDTH_PX, 794);
    assert.ok(Logic.A4_HEIGHT_PX > 1100 && Logic.A4_HEIGHT_PX < 1150);
  });
});
