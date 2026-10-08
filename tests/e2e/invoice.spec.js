const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const {
  fillValidProfile,
  fillClient,
  fillFirstService,
  prepareReadyInvoice,
  expectDownloadEnabled,
} = require("./helpers");

test.describe("black-box: invoice generator", () => {
  test("loads and shows core UI", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Invoice generator" })).toBeVisible();
    await expect(page.locator("#btn-add-line")).toBeVisible();
    await expect(page.locator("#preview-panel")).toBeAttached();

    // On mobile the preview starts collapsed so it cannot steal taps
    const isMobile = /mobile/i.test(testInfo.project.name);
    if (isMobile) {
      await expect(page.locator("#invoice")).toBeHidden();
      await page.locator("#preview-panel > summary").click();
      await expect(page.locator("#invoice")).toBeVisible();
    } else {
      await expect(page.locator("#invoice")).toBeVisible();
    }
  });

  test("adds a second service line", async ({ page }) => {
    await page.goto("/");
    const before = await page.locator(".line-item").count();
    await page.locator("#btn-add-line").click();
    await expect(page.locator(".line-item")).toHaveCount(before + 1);
  });

  test("calculates multi-line totals in preview", async ({ page }) => {
    await page.goto("/");
    await fillFirstService(page, { description: "Service A", qty: 2, rate: 1000 });
    await page.locator("#btn-add-line").click();
    const second = page.locator(".line-item").nth(1);
    await second.locator(".line-desc").fill("Service B");
    await second.locator(".line-qty").fill("3");
    await second.locator(".line-rate").fill("500");

    await expect(page.locator("#pv-total")).toHaveText("INR 3,500");
    await expect(page.locator("#pv-lines tr")).toHaveCount(2);
  });

  test("blocks download until payment fields are valid", async ({ page }) => {
    await page.goto("/");
    await fillClient(page);
    await fillFirstService(page, { description: "Work", qty: 1, rate: 100 });
    await page.locator("#sellerName").fill("TEST User");
    await page.locator("#sellerAddress").fill("Address");
    await page.locator("#sellerEmail").fill("a@b.com");
    await page.locator("#sellerPhone").fill("9999999999");
    await page.locator("#sellerPan").fill("BADPAN");
    await page.locator("#bankName").fill("HDFC Bank");
    await page.locator("#acctName").fill("Test User");
    await page.locator("#acctNumber").fill("123456789012");
    await page.locator("#ifsc").fill("HDFC0000053");
    await page.locator("#upi").fill("test@okaxis");

    await expect(page.locator("#btn-download")).toBeDisabled();
    await page.locator("#sellerPan").fill("ABCDE1234F");
    await expectDownloadEnabled(page);
  });

  test("persists profile in localStorage", async ({ page }) => {
    await page.goto("/");
    await fillValidProfile(page);
    await page.reload();
    await expect(page.locator("#sellerPan")).toHaveValue("FXJPS7605L");
    await expect(page.locator("#upi")).toHaveValue("sheetalsrinath-1@okaxis");
  });

  test("downloads a single-page PDF for short invoices", async ({ page }) => {
    await prepareReadyInvoice(page);

    const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
    await page.locator("#btn-download").click();
    const download = await downloadPromise;
    const filePath = path.join(
      test.info().outputDir,
      await download.suggestedFilename()
    );
    await download.saveAs(filePath);
    expect(fs.existsSync(filePath)).toBeTruthy();
    expect(fs.statSync(filePath).size).toBeGreaterThan(5_000);

    // Parse PDF page count (pdf-parse)
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(fs.readFileSync(filePath));
    expect(data.numpages).toBe(1);
  });

  test("date-range helper sets first line qty", async ({ page }) => {
    await page.goto("/");
    await page.locator(".qty-helper summary").click();
    await page.locator("#dateFrom").fill("2026-05-01");
    await page.locator("#dateTo").fill("2026-05-12");
    await page.locator("#btn-apply-range").click();
    await expect(page.locator(".line-item").first().locator(".line-qty")).toHaveValue(
      "12"
    );
  });
});
