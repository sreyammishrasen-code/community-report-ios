import { COUNTY_URL, type Category, type Report } from "./domain";

const solutionIds: Partial<Record<Category, string>> = {
  pothole: "1-234ONR",
  sidewalk: "1-88AYE8",
  debris: "1-6GNOGD",
  dumping: "1-3G15XN",
  tree: "1-27LDL1",
  sign: "1-88AYCL",
};

export const destination = (r: Report) => {
  const id = r.category && solutionIds[r.category];
  return id ? `${COUNTY_URL}Solutions.aspx?SolutionId=${id}` : COUNTY_URL;
};

export const COUNTY_STATUS_URL = `${COUNTY_URL}CheckStatus.aspx`;

export function automationError(r: Report) {
  if (!r.category || !solutionIds[r.category])
    return "This report needs a service choice on the MC311 website.";
  if (!r.contact) return "Contact details are required for the county request.";
  if (r.receipt) return "This report already has a county request number.";
  if (r.location.kind === "intersection") {
    if (
      !countyStreet(r.location.street, r.location.streetType).type ||
      !countyStreet(r.location.crossStreet, r.location.crossStreetType).type
    )
      return "Choose a street type for both streets before sending an intersection report.";
  }
  return null;
}

export function countyNavigationAllowed(raw: string) {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" &&
      u.hostname === "www3.montgomerycountymd.gov" &&
      u.pathname.toLowerCase().startsWith("/311/")
    );
  } catch {
    return false;
  }
}

const safeJSON = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

const streetSuffixes: Record<string, string> = {
  ALLEY: "ALY",
  AVENUE: "AVE",
  BOULEVARD: "BLVD",
  CIRCLE: "CIR",
  COURT: "CT",
  DRIVE: "DR",
  HIGHWAY: "HWY",
  LANE: "LN",
  PARKWAY: "PKWY",
  PLACE: "PL",
  ROAD: "RD",
  STREET: "ST",
  TERRACE: "TER",
  TRAIL: "TRL",
  WAY: "WAY",
};

function countyStreet(name: string, explicitType: string) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  const cleanType = explicitType.trim().toUpperCase().replace(/\.$/, "");
  if (cleanType)
    return { name: cleanName, type: streetSuffixes[cleanType] ?? cleanType };
  const match = cleanName.match(/^(.*\S)\s+([A-Za-z]+)\.?$/);
  if (!match) return { name: cleanName, type: "" };
  const candidate = match[2].toUpperCase();
  const type =
    streetSuffixes[candidate] ??
    (Object.values(streetSuffixes).includes(candidate) ? candidate : "");
  return type ? { name: match[1], type } : { name: cleanName, type: "" };
}

function formValues(r: Report) {
  const firstStreet = countyStreet(r.location.street, r.location.streetType);
  const crossStreet = countyStreet(
    r.location.crossStreet,
    r.location.crossStreetType,
  );
  return {
    TextBoxFirstName: r.contact!.firstName,
    TextBoxLastName: r.contact!.lastName,
    TextBoxEmail: r.contact!.email,
    TextBoxPhone: r.contact!.phone,
    ...(r.location.kind === "street"
      ? {
          TextBoxSTNumber: r.location.number,
          TextBoxSTName: firstStreet.name,
          TextBoxSTCity: r.location.city,
        }
      : {
          TextBoxSTName: firstStreet.name,
          TextBoxIntersectionSTName: crossStreet.name,
        }),
    TextBoxNotes: [
      r.description,
      r.location.note,
      r.location.kind === "intersection" && r.location.city
        ? `Community: ${r.location.city}`
        : "",
      r.location.latitude != null && r.location.longitude != null
        ? `Incident coordinates: ${r.location.latitude.toFixed(6)}, ${r.location.longitude.toFixed(6)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000),
  };
}

function baseScript(
  r: Report,
  mode: "fill" | "submit",
  token = "",
  photo?: string,
) {
  const invalid = automationError(r);
  if (invalid) throw new Error(invalid);
  const addressKind = r.location.kind === "street" ? "Street" : "Intersection";
  const firstStreet = countyStreet(r.location.street, r.location.streetType);
  const crossStreet = countyStreet(
    r.location.crossStreet,
    r.location.crossStreetType,
  );
  const streetTypes =
    r.location.kind === "street"
      ? { DropDownListSTType: firstStreet.type }
      : {
          DropDownListSTType: firstStreet.type,
          DropDownListIntersectionSTType: crossStreet.type,
        };
  return `(function () {
    const payload = ${safeJSON({
      token,
      mode,
      reportId: r.id,
      category: r.category,
      solutionId: solutionIds[r.category!],
      addressKind,
      fields: formValues(r),
      streetTypes,
      photo,
    })};
    const prefix = 'ctl00_MainContent_';
    const key = 'moco-submit-' + payload.reportId;
    const pageId = String(typeof performance !== 'undefined' ? performance.timeOrigin : '');
    const tell = (type, extra) => window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({source:'moco-automation', token:payload.token, type}, extra || {})));
    const fail = message => tell('error', {message});
    if (location.protocol !== 'https:' || location.hostname !== 'www3.montgomerycountymd.gov' || !location.pathname.toLowerCase().startsWith('/311/')) { fail('The county page left the allowed MC311 site. Nothing else was sent.'); return; }
    const body = document.body ? document.body.innerText : '';
    const stage = sessionStorage.getItem(key);
    const url = new URL(location.href);
    const receiptPattern = /(?:service request(?: number| #| id)?|request number|confirmation number|tracking number|reference number|sr(?: number| #| id))\\s*[:#-]?\\s*(\\d{8,12})/i;
    const receiptMatch = body.match(receiptPattern) || (document.documentElement ? document.documentElement.innerHTML.match(receiptPattern) : null);
    const queryReceipt = ['SRNumber', 'ServiceRequestNumber', 'RequestNumber']
      .map(name => url.searchParams.get(name))
      .find(value => /^\\d{8,12}$/.test(value || ''));
    const structuredReceipt = typeof document.querySelectorAll === 'function'
      ? Array.from(document.querySelectorAll('[id],[name],a[href]'))
          .filter(el => /(?:srnumber|service.?request|request.?number|confirmation.?number|tracking.?number|reference.?number)/i.test([el.id, el.getAttribute?.('name'), el.getAttribute?.('href')].filter(Boolean).join(' ')))
          .map(el => [el.value, el.innerText, el.textContent, el.getAttribute?.('href')].filter(Boolean).join(' '))
          .map(value => value.match(/(?:^|\\D)(\\d{8,12})(?:\\D|$)/)?.[1])
          .find(Boolean)
      : null;
    const trustedResponse = stage === 'submitting' || stage === 'uploading';
    const receipt = trustedResponse
      ? (receiptMatch ? receiptMatch[1] : (queryReceipt || structuredReceipt || (stage === 'uploading' ? sessionStorage.getItem(key + '-receipt') : null)))
      : null;
    if (receipt) {
      sessionStorage.setItem(key + '-receipt', receipt);
      if (payload.photo && stage !== 'uploading') {
        const fileInput = document.querySelector('input[type="file"]');
        const buttons = Array.from(document.querySelectorAll('button,input[type="submit"],input[type="button"]')).filter(el => /upload|attach|add photo/i.test((el.innerText || el.value || '').trim()));
        if (fileInput && buttons.length === 1 && typeof DataTransfer !== 'undefined') {
          try {
            const base64 = payload.photo.split(',').pop();
            const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            const transfer = new DataTransfer();
            transfer.items.add(new File([bytes], 'mc311-report.jpg', {type:'image/jpeg'}));
            fileInput.files = transfer.files;
            fileInput.dispatchEvent(new Event('change', {bubbles:true}));
            sessionStorage.setItem(key, 'uploading');
            tell('progress', {step:'photo', message:'Adding your photo'});
            buttons[0].click();
            return;
          } catch (_) {}
        }
      }
      const photoAttached = stage === 'uploading' && /(?:photo|attachment).{0,50}(?:uploaded|attached|received)|(?:uploaded|attached).{0,50}(?:photo|attachment)/i.test(body);
      sessionStorage.setItem(key, 'complete');
      tell('submitted', {receipt, photoStatus: photoAttached ? 'attached' : (payload.photo ? 'pending' : 'none')});
      return;
    }
    const newRequest = document.getElementById(prefix + 'ButtonNewSR');
    if (newRequest) {
      if (new URL(location.href).searchParams.get('SolutionId') !== payload.solutionId) { fail('The county service page does not match this report. Nothing was sent.'); return; }
      if (payload.mode !== 'submit') { tell('ready', {message:'County service page is ready.'}); return; }
      if (stage === 'opening' && sessionStorage.getItem(key + '-opening-page') === pageId) {
        tell('progress', {step:'request', message:'Waiting for the county request form'});
        return;
      }
      sessionStorage.setItem(key, 'opening');
      sessionStorage.setItem(key + '-opening-page', pageId);
      tell('progress', {step:'request', message:'Opening the county request form'});
      newRequest.click();
      return;
    }
    const rawCountyPath = location.pathname.toLowerCase();
    const countyPath = rawCountyPath.endsWith('/') ? rawCountyPath.slice(0, -1) : rawCountyPath;
    if (countyPath !== '/311/services.aspx') {
      if (['opening', 'address', 'submitting', 'uploading'].includes(stage)) {
        tell('progress', {step:'request', message:'Following the county site redirect'});
        return;
      }
      fail('The expected county request form did not open. Your report remains saved.');
      return;
    }
    if (!sessionStorage.getItem(key)) { fail('The county request session could not be verified. Nothing was submitted.'); return; }
    const submit = document.getElementById(prefix + 'ButtonSubmit');
    const kind = document.getElementById(prefix + 'DropDownListSTTypeSelect');
    if (!submit || !kind || !Object.keys(payload.fields).every(name => document.getElementById(prefix + name))) { fail('The county form has changed or is not ready. Your report was not resubmitted.'); return; }
    const desiredKind = Array.from(kind.options).find(option => option.text.trim() === payload.addressKind);
    if (!desiredKind) { fail('The county form does not offer the selected address type.'); return; }
    if (kind.value !== desiredKind.value) {
      sessionStorage.setItem(key, 'address');
      kind.value = desiredKind.value;
      kind.dispatchEvent(new Event('change', {bubbles:true}));
      tell('progress', {step:'request', message:'Preparing the incident address'});
      return;
    }
    for (const [name, suffix] of Object.entries(payload.streetTypes)) {
      if (!suffix) continue;
      const select = document.getElementById(prefix + name);
      const option = select && Array.from(select.options).find(item => item.text.trim().toUpperCase() === suffix.toUpperCase());
      if (!option) { fail('A street type is not available on the county form. Review the address and try again.'); return; }
      select.value = option.value;
      select.dispatchEvent(new Event('change', {bubbles:true}));
    }
    for (const [name, value] of Object.entries(payload.fields)) {
      const field = document.getElementById(prefix + name);
      field.value = value;
      field.dispatchEvent(new Event('input', {bubbles:true}));
      field.dispatchEvent(new Event('change', {bubbles:true}));
    }
    const retained = Object.entries(payload.fields).every(([name, value]) => document.getElementById(prefix + name).value === value);
    if (!retained) { fail('Some report fields were not retained by the county form. Nothing was submitted.'); return; }
    const form = submit.form;
    if (form && typeof form.checkValidity === 'function' && !form.checkValidity()) { fail('The county form requires another field. Nothing was submitted.'); return; }
    if (payload.mode === 'fill') { tell('ready', {message:'Fields filled. Review them, then submit on the county page.'}); return; }
    if (sessionStorage.getItem(key) === 'submitting') {
      const submittedFrom = sessionStorage.getItem(key + '-page');
      const thisPage = pageId;
      if (submittedFrom && submittedFrom === thisPage) {
        tell('progress', {step:'receipt', message:'Submission sent; waiting for the county response'});
        return;
      }
      const selectors = '.validation-summary-errors,[role="alert"],[id*="ValidationSummary"],[id*="RequiredFieldValidator"],[id*="RegularExpressionValidator"]';
      const validations = typeof document.querySelectorAll === 'function'
        ? Array.from(document.querySelectorAll(selectors))
            .filter(el => {
              const style = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(el) : null;
              return (!style || (style.display !== 'none' && style.visibility !== 'hidden')) && el.getAttribute?.('aria-hidden') !== 'true';
            })
            .map(el => (el.innerText || el.textContent || '').trim()).filter(Boolean)
        : [];
      const responseError = body.split(/\\n+/)
        .map(line => line.trim())
        .find(line => line.length >= 5 && line.length <= 240 && /(?:is required|invalid|not valid|unable to|could not|please (?:enter|select|provide)|an error occurred)/i.test(line));
      if (validations.length || responseError) {
        fail(('MC311 did not accept the form: ' + (validations.join(' ') || responseError)).slice(0, 500));
      } else {
        tell('uncertain', {message:'MC311 returned to the request form without a readable receipt. The request may already exist; check your confirmation email or county status before trying again.'});
      }
      return;
    }
    sessionStorage.setItem(key, 'submitting');
    sessionStorage.setItem(key + '-page', pageId);
    tell('progress', {step:'receipt', message:'Waiting for a county receipt'});
    submit.click();
  })(); true;`;
}

/** Fills a visible county form but intentionally leaves Submit to the resident. */
export function fillScript(r: Report) {
  return baseScript(r, "fill");
}

/** Runs only after the resident presses the app's explicit Send button. */
export function submissionScript(r: Report, token: string, photo?: string) {
  return baseScript(r, "submit", token, photo);
}
