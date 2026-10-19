import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { destination, fillScript, submissionScript } from "../src/county";
import { categories, newReport, type Category } from "../src/domain";

function report(category: Category = "pothole") {
  return {
    ...newReport("test"),
    category,
    contact: {
      firstName: "Test",
      lastName: "Resident",
      email: "test@example.com",
      phone: "240-555-0100",
    },
    description: `A damaged area. </script>"; throw new Error('injected'); //`,
    location: {
      ...newReport("test").location,
      number: "123",
      street: "Example",
      streetType: "ST",
      city: "Rockville",
      confirmed: true,
    },
  };
}

function fixture() {
  const r = report();
  const ids = [
    "TextBoxFirstName",
    "TextBoxLastName",
    "TextBoxEmail",
    "TextBoxPhone",
    "TextBoxSTNumber",
    "TextBoxSTName",
    "TextBoxSTCity",
    "TextBoxNotes",
  ];
  const fields: Record<string, any> = Object.fromEntries(
    ids.map((id) => [id, { value: "", dispatchEvent() {} }]),
  );
  fields.DropDownListSTTypeSelect = {
    value: "street",
    options: [{ value: "street", text: "Street" }],
    dispatchEvent() {},
  };
  fields.DropDownListSTType = {
    value: "",
    options: [
      { value: "st", text: "ST" },
      { value: "rd", text: "RD" },
    ],
    dispatchEvent() {},
  };
  let submitted = 0;
  fields.ButtonSubmit = {
    form: { checkValidity: () => true },
    click: () => submitted++,
  };
  const messages: Record<string, any>[] = [];
  const session = new Map([["moco-submit-test", "selected"]]);
  const context = {
    location: {
      protocol: "https:",
      hostname: "www3.montgomerycountymd.gov",
      pathname: "/311/Services.aspx",
      href: "https://www3.montgomerycountymd.gov/311/Services.aspx?SolutionId=-1",
    },
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, value),
    },
    document: {
      body: { innerText: "Pothole Repair request form" },
      getElementById: (name: string) =>
        fields[name.replace("ctl00_MainContent_", "")],
      querySelector: () => null,
      querySelectorAll: (): any[] => [],
    },
    performance: { timeOrigin: 100 },
    window: {
      ReactNativeWebView: {
        postMessage: (raw: string) => messages.push(JSON.parse(raw)),
      },
    },
    URL,
    Event: class {
      constructor(_name: string) {}
    },
  };
  return { r, fields, messages, context, session, submitted: () => submitted };
}

test("all classified categories except other have a specific official service destination", () => {
  for (const category of categories) {
    const url = destination(report(category.id));
    if (category.id === "other")
      assert.equal(url, "https://www3.montgomerycountymd.gov/311/");
    else assert.match(url, /Solutions\.aspx\?SolutionId=1-/);
  }
});

test("fill script safely treats resident input as data and never submits", () => {
  const f = fixture();
  runInNewContext(fillScript(f.r), f.context);
  assert.equal(f.fields.TextBoxNotes.value, f.r.description);
  assert.equal(f.fields.TextBoxFirstName.value, "Test");
  assert.equal(f.fields.DropDownListSTType.value, "st");
  assert.equal(f.submitted(), 0);
  assert.equal(f.messages[0].type, "ready");
});

test("street suffix typed with the name is split into MC311's separate street-type field", () => {
  const f = fixture();
  f.r.location.street = "Brent Rd";
  f.r.location.streetType = "";
  runInNewContext(fillScript(f.r), f.context);
  assert.equal(f.fields.TextBoxSTName.value, "Brent");
  assert.equal(f.fields.DropDownListSTType.value, "rd");
});

test("changed county schema stops before writing personal fields", () => {
  const f = fixture();
  delete f.fields.TextBoxSTCity;
  runInNewContext(fillScript(f.r), f.context);
  assert.equal(f.fields.TextBoxFirstName.value, "");
  assert.match(f.messages[0].message, /changed or is not ready/);
});

test("address-kind postback happens before filling contact details", () => {
  const f = fixture();
  f.fields.DropDownListSTTypeSelect.value = "intersection";
  runInNewContext(fillScript(f.r), f.context);
  assert.equal(f.fields.TextBoxFirstName.value, "");
  assert.equal(f.messages[0].type, "progress");
});

test("opening the county request form is idempotent across duplicate load callbacks", () => {
  const f = fixture();
  let opened = 0;
  f.session.clear();
  f.context.location.pathname = "/311/Solutions.aspx";
  f.context.location.href =
    "https://www3.montgomerycountymd.gov/311/Solutions.aspx?SolutionId=1-234ONR";
  f.fields.ButtonNewSR = { click: () => opened++ };
  delete f.fields.ButtonSubmit;

  runInNewContext(submissionScript(f.r, "token"), f.context);
  runInNewContext(submissionScript(f.r, "token"), f.context);

  assert.equal(opened, 1);
  assert.equal(f.session.get("moco-submit-test"), "opening");
  assert.match(
    f.messages.at(-1)?.message,
    /waiting for the county request form/i,
  );
});

test("an intermediate MC311 redirect is allowed while the request form is opening", () => {
  const f = fixture();
  f.session.set("moco-submit-test", "opening");
  f.context.location.pathname = "/311/CookieCheck.aspx";
  f.context.location.href =
    "https://www3.montgomerycountymd.gov/311/CookieCheck.aspx";
  delete f.fields.ButtonSubmit;

  runInNewContext(submissionScript(f.r, "token"), f.context);

  assert.equal(f.messages.at(-1)?.type, "progress");
  assert.match(
    f.messages.at(-1)?.message,
    /following the county site redirect/i,
  );
});

test("submission script clicks Submit once and ignores duplicate callbacks from the same page", () => {
  const f = fixture();
  runInNewContext(submissionScript(f.r, "token"), f.context);
  assert.equal(f.submitted(), 1);
  assert.equal(f.messages.at(-1)?.type, "progress");
  assert.equal(f.messages.at(-1)?.step, "receipt");
  runInNewContext(submissionScript(f.r, "token"), f.context);
  assert.equal(f.submitted(), 1);
  assert.equal(f.messages.at(-1)?.type, "progress");
  assert.match(f.messages.at(-1)?.message, /waiting for the county response/i);
});

test("a new request-form page without a receipt is uncertain, not safe to resubmit", () => {
  const f = fixture();
  runInNewContext(submissionScript(f.r, "token"), f.context);
  f.context.performance.timeOrigin = 200;
  runInNewContext(submissionScript(f.r, "token"), f.context);
  assert.equal(f.submitted(), 1);
  assert.equal(f.messages.at(-1)?.type, "uncertain");
  assert.match(f.messages.at(-1)?.message, /may already exist/i);
});

test("a returned form with county validation text reports a definite form failure", () => {
  const f = fixture();
  runInNewContext(submissionScript(f.r, "token"), f.context);
  f.context.performance.timeOrigin = 200;
  f.context.document.querySelectorAll = () => [
    {
      innerText: "Building number is required.",
      textContent: "Building number is required.",
    },
  ];
  runInNewContext(submissionScript(f.r, "token"), f.context);
  assert.equal(f.messages.at(-1)?.type, "error");
  assert.match(f.messages.at(-1)?.message, /Building number is required/);
});

test("county confirmation yields a verified numeric receipt without another submit", () => {
  const f = fixture();
  f.session.set("moco-submit-test", "submitting");
  f.context.document.body.innerText =
    "Thank you. Service Request Number: 1590439979";
  runInNewContext(submissionScript(f.r, "token"), f.context);
  assert.equal(f.submitted(), 0);
  assert.deepEqual(JSON.parse(JSON.stringify(f.messages[0])), {
    source: "moco-automation",
    token: "token",
    type: "submitted",
    receipt: "1590439979",
    photoStatus: "none",
  });
});

test("county confirmation can also supply the receipt in the status URL", () => {
  const f = fixture();
  f.session.set("moco-submit-test", "submitting");
  f.context.location.href =
    "https://www3.montgomerycountymd.gov/311/CheckStatus.aspx?SRNumber=1590439979";
  f.context.location.pathname = "/311/CheckStatus.aspx";
  runInNewContext(submissionScript(f.r, "token"), f.context);
  assert.equal(f.messages[0].type, "submitted");
  assert.equal(f.messages[0].receipt, "1590439979");
});

test("unverified sessions and disallowed origins stop before contact fields are written", () => {
  const f = fixture();
  f.context.sessionStorage.getItem = () => null;
  runInNewContext(fillScript(f.r), f.context);
  assert.equal(f.fields.TextBoxEmail.value, "");
  assert.match(f.messages[0].message, /session could not be verified/);

  const other = fixture();
  other.context.location.hostname = "example.com";
  runInNewContext(fillScript(other.r), other.context);
  assert.equal(other.fields.TextBoxEmail.value, "");
  assert.match(other.messages[0].message, /left the allowed/);
});
