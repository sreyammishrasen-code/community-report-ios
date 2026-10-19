import test from "node:test";
import assert from "node:assert/strict";
import {
  newReport,
  blankLocation,
  contactError,
  locationError,
  reviewError,
  saveReceipt,
  stateSchema,
  initialState,
  summary,
  categories,
  analysisSchema,
  confirmCountySubmission,
} from "../src/domain";
import { countyNavigationAllowed, fillScript } from "../src/county";

const ready = () => ({
  ...newReport("test"),
  category: "pothole" as const,
  description: "A large pothole in the roadway.",
  location: {
    ...blankLocation,
    number: "123",
    street: "Example",
    streetType: "ST",
    city: "Rockville",
    confirmed: true,
  },
  contact: {
    firstName: "Test",
    lastName: "Resident",
    email: "test@example.com",
    phone: "",
  },
});
test("new reports are unsent and have no invented county receipt", () => {
  const r = newReport("a");
  assert.equal(r.status, "draft");
  assert.equal(r.receipt, undefined);
  assert.equal(r.timeline.length, 1);
});
test("street and intersection need a confirmed location", () => {
  const l = ready().location;
  assert.equal(locationError(l), null);
  assert.ok(locationError({ ...l, number: "" }));
  assert.ok(locationError({ ...l, confirmed: false }));
  assert.ok(locationError({ ...l, city: "" }));
  assert.ok(locationError({ ...l, kind: "intersection" }));
  assert.equal(
    locationError({ ...l, kind: "intersection", crossStreet: "Second St" }),
    null,
  );
});
test("validates contact, category and description before review", () => {
  const r = ready();
  assert.equal(contactError(r.contact), null);
  assert.equal(reviewError(r), null);
  assert.ok(contactError({ ...r.contact, email: "broken" }));
  assert.ok(contactError({ ...r.contact, firstName: " " }));
  assert.ok(reviewError({ ...r, category: undefined }));
  assert.ok(reviewError({ ...r, description: "" }));
});
test("manual receipt stays unverified and does not assert attachment success", () => {
  const r = saveReceipt(ready(), "SR-12345");
  assert.equal(r.status, "unverified");
  assert.equal(r.receipt, "SR-12345");
  assert.match(r.timeline.at(-1)!.text, /unverified/);
  assert.throws(() => saveReceipt(r, "<script>"));
});
test("county callback stores a verified receipt and only confirmed photo status", () => {
  const r = confirmCountySubmission(ready(), "1590439979", "attached");
  assert.equal(r.status, "submitted");
  assert.equal(r.receiptSource, "county");
  assert.equal(r.photoStatus, "attached");
  assert.equal(r.receipt, "1590439979");
  assert.match(r.timeline.at(-1)!.text, /Photo attached/);
  assert.throws(() => confirmCountySubmission(ready(), "DEMO-123", "none"));
});
test("persistence schema validates data and rejects unknown versions", () => {
  assert.equal(
    stateSchema.parse({ ...initialState, reports: [ready()] }).reports.length,
    1,
  );
  assert.equal(
    stateSchema.safeParse({ ...initialState, version: 9 }).success,
    false,
  );
});
test("shared summary excludes contact information and labels unverified receipts", () => {
  const text = summary(saveReceipt(ready(), "SR-123"));
  assert.ok(!text.includes("test@example.com"));
  assert.match(text, /unverified/);
});
test("all supported categories are valid structured AI results", () => {
  for (const c of categories)
    assert.ok(
      analysisSchema.safeParse({
        category: c.id,
        description: "Issue description",
        clarification: null,
      }).success,
    );
  assert.ok(
    !analysisSchema.safeParse({
      category: "invented",
      description: "Issue",
      clarification: null,
    }).success,
  );
});
test("county navigation is origin and path restricted", () => {
  assert.equal(
    countyNavigationAllowed(
      "https://www3.montgomerycountymd.gov/311/Services.aspx",
    ),
    true,
  );
  for (const url of [
    "http://www3.montgomerycountymd.gov/311/",
    "https://www3.montgomerycountymd.gov.attacker.test/311/",
    "javascript:alert(1)",
    "https://www3.montgomerycountymd.gov/other/",
  ])
    assert.equal(countyNavigationAllowed(url), false);
});
test("assisted filling is fill mode and rejects only unmapped categories", () => {
  const script = fillScript(ready());
  assert.match(script, /"mode":"fill"/);
  assert.doesNotThrow(() => fillScript({ ...ready(), category: "tree" }));
  assert.throws(() => fillScript({ ...ready(), category: "other" }));
  assert.throws(() => fillScript(saveReceipt(ready(), "SR-123")));
});
