import type { Report } from "../domain";
import { Note } from "./UI";
export function CountyPortal({
  report,
  automatic,
}: {
  report: Report;
  automatic?: boolean;
  onProgress?: (step: "request" | "photo" | "receipt", message: string) => void;
  onSubmitted?: (result: {
    receipt: string;
    photoStatus: "none" | "pending" | "attached";
  }) => void;
  onFailure?: (message: string) => void;
  onUncertain?: (message: string) => void;
}) {
  if (automatic) {
    return (
      <Note>Automatic submission is available in the iOS and Android app.</Note>
    );
  }
  return (
    <Note>
      For your privacy, the web app does not embed the county form. Copy your
      summary and open MC311 in a new tab. The native app can submit supported
      report categories automatically.{" "}
      {!report.category
        ? "Choose the matching service on the county site."
        : ""}
    </Note>
  );
}
