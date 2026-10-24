import puppeteer from "puppeteer";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { startStatic } from "./static-server.mjs";

// Isolated browser profile, synthetic data only. Never contacts the county or OpenAI.
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
let simulatingOffline = false;
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  // Chromium may report a background resource request during the deliberate
  // offline test. Keep catching application exceptions and all other errors.
  if (
    simulatingOffline &&
    message.text() === "Failed to load resource: net::ERR_INTERNET_DISCONNECTED"
  )
    return;
  if (message.type() === "error") errors.push(message.text());
});
await page.setViewport({
  width: 390,
  height: 844,
  isMobile: true,
  hasTouch: true,
});
const local = process.env.TEST_WEB_URL ? undefined : await startStatic();
const base = process.env.TEST_WEB_URL ?? local.url;
await page.setRequestInterception(true);
page.on("request", (request) => {
  const url = request.url();
  if (
    url.startsWith(base) ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  )
    request.continue();
  else request.abort();
});
const text = async (value) =>
  page.waitForFunction((v) => document.body.innerText.includes(v), {}, value);
const click = async (label) => {
  const locator = page.locator(`::-p-aria(${label}[role="button"])`);
  await locator.click();
};
const fill = (label, value) =>
  page.locator(`[aria-label=${JSON.stringify(label)}]`).fill(value);
const snap = async (name) => {
  await mkdir("review", { recursive: true });
  await page.screenshot({ path: `review/${name}.png` });
};
try {
  await page.goto(base, { waitUntil: "networkidle0" });
  await text("Get started");
  await click("Get started");
  await text("Your neighborhood,");
  await click("Report an issue");
  await text("Before your first report.");
  await click("Start my report");
  await text("What did you notice?");
  assert.equal(
    await page.evaluate(() =>
      document.body.innerText.includes("Set up AI connection"),
    ),
    false,
  );
  await fill(
    "Description",
    "Several potholes in the road near the library entrance.",
  );
  await snap("flow-capture");
  await click("Save draft for later");
  await text("Saved. Send it later.");
  await click("Back to my reports");
  await text("Draft · not sent");
  await page.reload({ waitUntil: "networkidle0" });
  await text("Draft · not sent");
  await click("New report");
  await text("What did you notice?");
  assert.equal(
    await page.$eval('[aria-label="Description"]', (e) => e.value),
    "Several potholes in the road near the library entrance.",
  );
  await click("Continue to location");
  await text("Is it right here?");
  await click("Continue to category");
  await text("Enter a street and city");
  await fill("Nearest building number", "123");
  await fill("Street name", "Example");
  await fill("Street type (ST, RD, AVE…) · recommended", "ST");
  await fill("City or community", "Rockville");
  await page
    .locator('[aria-label="I confirm this is the issue location"]')
    .click();
  await snap("flow-location");
  await click("Continue to category");
  await text("Choose the best fit.");
  await click("Pothole repair");
  await text("Ready for a quick look?");
  await snap("flow-review");
  await click("Continue to contact details");
  await text("How can we reach you?");
  await click("Save and review");
  await text("Enter your first and last name.");
  await fill("First name", "Test");
  await fill("Last name", "Resident");
  await fill("Email", "not-an-email");
  await click("Save and review");
  await text("Enter a valid email address.");
  await fill("Email", "test@example.com");
  await click("Save and review");
  await text("Looks good?");
  await snap("flow-confirm");
  assert.equal(
    await page
      .locator('::-p-aria(Continue on MC311[role="button"])')
      .map(
        (e) =>
          e.getAttribute("aria-disabled") === "true" || e.disabled === true,
      )
      .wait(),
    true,
  );
  await page
    .locator(
      '[aria-label="I agree to send my report, location and contact details to MC311"]',
    )
    .click();
  await click("Continue on MC311");
  await text("Finish with the county.");
  // No official-site or network button is clicked. This is only local handoff state.
  await click("No confirmation yet · keep my copy");
  await text("Confirmation needed");
  await click("Add a county request number");
  await text("Have a request number?");
  await fill("County request number", "TEST-LOCAL-123");
  await click("Save request number");
  await text("Receipt saved · unverified");
  await snap("flow-receipt");
  await page.reload({ waitUntil: "networkidle0" });
  await text("Receipt saved · unverified");
  await click("View report summary");
  await text("What you reported.");
  await click("Back to timeline");
  await text("REPORT TIMELINE");
  await click("Archive this local record");
  await text("My reports");
  await page.locator('::-p-aria(Archived[role="tab"])').click();
  await text("Pothole repair");
  await click("Pothole repair");
  await text("Receipt saved · unverified");
  await click("Back to my reports");
  await page.locator('::-p-aria(You[role="tab"])').click();
  await text("Your preferences.");
  assert.equal(
    await page.evaluate(() =>
      document.body.innerText.includes("AI connection"),
    ),
    false,
  );
  await click("Privacy & storage");
  await text("Your report. Your choice.");
  await click("Manage app data");
  await text("Delete your app data?");
  assert.equal(
    await page
      .locator('::-p-aria(Delete app data permanently[role="button"])')
      .map(
        (e) =>
          e.getAttribute("aria-disabled") === "true" || e.disabled === true,
      )
      .wait(),
    true,
  );
  await click("Keep my data");
  await text("Your preferences.");
  await page.setViewport({
    width: 320,
    height: 568,
    isMobile: true,
    hasTouch: true,
  });
  await snap("flow-settings-small");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.locator('::-p-aria(Home[role="tab"])').click();
  await text("Your neighborhood,");
  await click("Report an issue");
  await text("Before your first report.");
  await click("Start my report");
  await text("What did you notice?");
  simulatingOffline = true;
  await page.setOfflineMode(true);
  await fill("Description", "Broken sidewalk beside the example library.");
  await click("Save draft for later");
  await text("Saved. Send it later.");
  await click("Back to my reports");
  await text("Draft · not sent");
  await page.setOfflineMode(false);
  await page.reload({ waitUntil: "networkidle0" });
  simulatingOffline = false;
  await text("Draft · not sent");
  await click("New report");
  await text("What did you notice?");
  assert.equal(
    await page.$eval('[aria-label="Description"]', (e) => e.value),
    "Broken sidewalk beside the example library.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: capture, validation, persistent and offline drafts, manual category, contact, consent, handoff, unverified receipt, archive, privacy and small-screen layout. No external submission.",
  );
} catch (error) {
  await snap("flow-error");
  console.error(await page.$eval("body", (e) => e.innerText));
  throw error;
} finally {
  await browser.close();
  if (local) {
    local.server.closeAllConnections();
    local.server.close();
  }
}
