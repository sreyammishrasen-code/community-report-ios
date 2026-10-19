import Svg, { Path } from "react-native-svg";
import { Platform } from "react-native";
import { colors } from "../theme";

const paths = {
  back: "M15 5 8 12l7 7",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 6 6 6-6 6",
  check: "m5 12 4 4L19 6",
  spark: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z",
  home: "m3 11 9-8 9 8v10h-6v-7H9v7H3Z",
  list: "M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 22v-3a8 8 0 0 1 16 0v3",
  edit: "m4 16 12-12 4 4L8 20H4ZM13 7l4 4",
  close: "m6 6 12 12M18 6 6 18",
  camera: "M3 6h4l2-3h6l2 3h4v15H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  mic: "M9 4a3 3 0 0 1 6 0v8a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  image: "M3 3h18v18H3Zm0 13 6-6 5 5 3-3 4 4M16 7h.1",
  road: "M7 2 3 22M17 2l4 20M12 3v4m0 4v3m0 4v3",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  tree: "m12 2-7 9h3l-5 6h8v5h2v-5h8l-5-6h3Z",
  sign: "M12 2v20M4 4h13l4 4-4 4H4Z",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Zm-4 9 3 3 5-6",
  globe:
    "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M2 12h20M12 2c-6 7-6 13 0 20 6-7 6-13 0-20Z",
  bell: "M5 17h14l-2-3V8A5 5 0 0 0 7 8v6ZM10 21h4",
  clock: "M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2",
  alert: "M12 2 1 21h22ZM12 8v6m0 3h.1",
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 24,
  color = colors.forest,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      {...(Platform.OS === "web"
        ? { "aria-hidden": true }
        : { accessible: false })}
    >
      <Path
        d={paths[name]}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
