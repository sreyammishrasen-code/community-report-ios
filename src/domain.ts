import { z } from "zod";

export const categories = [
  {
    id: "pothole",
    name: "Pothole repair",
    hint: "Holes and damage in the road surface",
    icon: "road",
  },
  {
    id: "sidewalk",
    name: "Sidewalk damage",
    hint: "Cracked, uneven or broken sidewalks",
    icon: "home",
  },
  {
    id: "debris",
    name: "Roadside debris",
    hint: "Material along a road or shoulder",
    icon: "trash",
  },
  {
    id: "dumping",
    name: "Illegal dumping",
    hint: "Dumped material on property",
    icon: "trash",
  },
  {
    id: "tree",
    name: "Fallen tree or limb",
    hint: "Non-emergency trees or branches",
    icon: "tree",
  },
  {
    id: "sign",
    name: "Damaged sign",
    hint: "Missing or damaged street signs",
    icon: "sign",
  },
  {
    id: "other",
    name: "Something else",
    hint: "Find the right service with MC311",
    icon: "list",
  },
] as const;
export const categorySchema = z.enum([
  "pothole",
  "sidewalk",
  "debris",
  "dumping",
  "tree",
  "sign",
  "other",
]);
export type Category = z.infer<typeof categorySchema>;
export const contactSchema = z.object({
  firstName: z.string().max(80),
  lastName: z.string().max(80),
  email: z.string().max(254),
  phone: z.string().max(30),
});
export type Contact = z.infer<typeof contactSchema>;
export const emptyContact: Contact = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};
export const locationSchema = z.object({
  kind: z.enum(["street", "intersection"]),
  number: z.string().max(20),
  street: z.string().max(160),
  streetType: z.string().max(10),
  crossStreet: z.string().max(160),
  crossStreetType: z.string().max(10).default(""),
  city: z.string().max(100),
  note: z.string().max(400),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().nullable().optional(),
  confirmed: z.boolean(),
  jurisdiction: z.enum(["unknown", "county", "other"]),
});
export type IssueLocation = z.infer<typeof locationSchema>;
export const blankLocation: IssueLocation = {
  kind: "street",
  number: "",
  street: "",
  streetType: "",
  crossStreet: "",
  crossStreetType: "",
  city: "",
  note: "",
  confirmed: false,
  jurisdiction: "unknown",
};
export const reportSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  description: z.string().max(2000),
  originalDescription: z.string().max(2000),
  category: categorySchema.optional(),
  source: z.enum(["manual", "ai"]).default("manual"),
  photo: z.string().optional(),
  location: locationSchema,
  contact: contactSchema.optional(),
  status: z.enum(["draft", "sending", "submitted", "handoff", "unverified"]),
  receipt: z.string().max(80).optional(),
  receiptSource: z.enum(["county", "resident"]).optional(),
  photoStatus: z.enum(["none", "pending", "attached"]).optional(),
  archived: z.boolean().default(false),
  timeline: z.array(z.object({ at: z.string(), text: z.string() })).max(200),
});
export type Report = z.infer<typeof reportSchema>;
export const analysisSchema = z.object({
  category: categorySchema,
  description: z.string().min(1).max(2000),
  clarification: z.string().max(300).nullable(),
});
export type Analysis = z.infer<typeof analysisSchema>;
export const preferencesSchema = z.object({
  aiConsent: z.boolean(),
  reminders: z.boolean(),
});
export const stateSchema = z.object({
  version: z.literal(1),
  reports: z.array(reportSchema).max(200),
  preferences: preferencesSchema,
});
export type SavedState = z.infer<typeof stateSchema>;
export const initialState: SavedState = {
  version: 1,
  reports: [],
  preferences: { aiConsent: false, reminders: false },
};
export function newReport(id: string): Report {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    description: "",
    originalDescription: "",
    location: { ...blankLocation },
    source: "manual",
    status: "draft",
    archived: false,
    timeline: [{ at: now, text: "Draft created on this device" }],
  };
}
export const categoryName = (id?: Category) =>
  categories.find((c) => c.id === id)?.name ?? "New report";
export function addressText(l: IssueLocation) {
  return [
    l.kind === "intersection"
      ? [l.street, l.crossStreet].filter(Boolean).join(" & ")
      : [l.number, l.street, l.streetType].filter(Boolean).join(" "),
    l.city,
  ]
    .filter(Boolean)
    .join(", ");
}
export function contactError(c: Contact) {
  if (!c.firstName.trim() || !c.lastName.trim())
    return "Enter your first and last name.";
  if (!z.email().safeParse(c.email.trim()).success)
    return "Enter a valid email address.";
  if (c.phone && !/^[+()\d\s.-]{7,30}$/.test(c.phone))
    return "Check the phone number, or leave it blank.";
  return null;
}
export function locationError(l: IssueLocation) {
  if (!l.street.trim() || !l.city.trim())
    return "Enter a street and city or community.";
  if (l.kind === "street" && !l.number.trim())
    return "Enter the nearest building number required by the MC311 form.";
  if (l.kind === "intersection" && !l.crossStreet.trim())
    return "Enter the cross street.";
  if (!l.confirmed) return "Confirm this is the issue location.";
  return null;
}
export function reviewError(r: Report) {
  if (r.description.trim().length < 10)
    return "Describe the issue in at least 10 characters.";
  if (!r.category) return "Choose an issue category.";
  return locationError(r.location);
}
export function summary(r: Report) {
  return [
    categoryName(r.category),
    addressText(r.location),
    r.location.note,
    r.location.latitude != null
      ? `Incident coordinates: ${r.location.latitude.toFixed(6)}, ${r.location.longitude?.toFixed(6)}`
      : "",
    "",
    r.description,
    r.receipt
      ? r.receiptSource === "county"
        ? `County service request number: ${r.receipt}`
        : `County request number (entered by resident, unverified): ${r.receipt}`
      : "No county receipt recorded.",
  ]
    .filter((v) => v !== undefined)
    .join("\n");
}
export function saveReceipt(r: Report, receipt: string): Report {
  const value = receipt.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{2,79}$/.test(value))
    throw new Error(
      "Enter the request number from your county confirmation (3–80 letters, numbers, spaces or hyphens).",
    );
  const now = new Date().toISOString();
  return {
    ...r,
    status: "unverified",
    receipt: value,
    receiptSource: "resident",
    photoStatus: r.photo ? "pending" : "none",
    updatedAt: now,
    timeline: [
      ...r.timeline.slice(-199),
      {
        at: now,
        text: "Receipt entered by you; county status and photo attachment unverified",
      },
    ],
  };
}
export function confirmCountySubmission(
  r: Report,
  receipt: string,
  photoStatus: "none" | "pending" | "attached",
): Report {
  const value = receipt.trim();
  if (!/^\d{8,12}$/.test(value))
    throw new Error(
      "MC311 returned an unexpected request number. Check your confirmation email.",
    );
  const now = new Date().toISOString();
  const events = [
    { at: now, text: `Report received by MC311 · ${value}` },
    ...(photoStatus === "attached"
      ? [{ at: now, text: "Photo attached to the county request" }]
      : r.photo
        ? [{ at: now, text: "Photo attachment could not be confirmed" }]
        : []),
  ];
  return {
    ...r,
    status: "submitted",
    receipt: value,
    receiptSource: "county",
    photoStatus,
    updatedAt: now,
    timeline: [...r.timeline, ...events].slice(-200),
  };
}
export const statusLabel = (r: Report) =>
  r.status === "draft"
    ? "Draft · not sent"
    : r.status === "submitted"
      ? "Received by MC311"
      : r.status === "sending"
        ? "Sending started · verify before retrying"
        : r.status === "handoff"
          ? "Confirmation needed"
          : "Receipt saved · unverified";
export const COUNTY_URL = "https://www3.montgomerycountymd.gov/311/";
export const POTHOLE_URL = `${COUNTY_URL}Solutions.aspx?SolutionId=1-234ONR`;
