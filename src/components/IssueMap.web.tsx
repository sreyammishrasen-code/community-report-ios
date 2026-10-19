import type { IssueLocation } from "../domain";
import { Note } from "./UI";
export function IssueMap({
  location,
}: {
  location: IssueLocation;
  onPin: (lat: number, lng: number) => void;
}) {
  return (
    <Note>
      {location.latitude != null
        ? `GPS: ${location.latitude.toFixed(6)}, ${location.longitude?.toFixed(6)}. Enter and confirm the issue address below.`
        : "Enter the issue address below, or use browser location. An interactive pin map is available in the native app."}
    </Note>
  );
}
