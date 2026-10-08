async function fillValidProfile(page) {
  await page.locator("#sellerName").fill("SHEETAL SRINATH");
  await page
    .locator("#sellerAddress")
    .fill("Bengaluru, Karnataka");
  await page.locator("#sellerEmail").fill("sheetalsrinath@gmail.com");
  await page.locator("#sellerPhone").fill("+91 99168 09856");
  await page.locator("#sellerPan").fill("FXJPS7605L");
  await page.locator("#bankName").fill("HDFC Bank");
  await page.locator("#acctName").fill("Sheetal S");
  await page.locator("#acctNumber").fill("50100209350007");
  await page.locator("#ifsc").fill("HDFC0000053");
  await page.locator("#upi").fill("sheetalsrinath-1@okaxis");
}

async function fillClient(page) {
  await page.locator("#clientName").fill("Keemaya Productions Private Limited");
  await page
    .locator("#clientAddress")
    .fill("Mumbai, Maharashtra");
}

async function fillFirstService(page, { description, qty, rate }) {
  const card = page.locator(".line-item").first();
  await card.locator(".line-desc").fill(description);
  await card.locator(".line-qty").fill(String(qty));
  await card.locator(".line-rate").fill(String(rate));
}

async function prepareReadyInvoice(page) {
  await page.goto("/");
  await page.locator("#invoiceNumber").fill("003");
  await fillClient(page);
  await fillValidProfile(page);
  await fillFirstService(page, {
    description: "Consulting",
    qty: 2,
    rate: 1000,
  });
  await expectDownloadEnabled(page);
}

async function expectDownloadEnabled(page) {
  await page.waitForFunction(() => {
    const btn = document.getElementById("btn-download");
    return btn && !btn.disabled;
  });
}

module.exports = {
  fillValidProfile,
  fillClient,
  fillFirstService,
  prepareReadyInvoice,
  expectDownloadEnabled,
};
