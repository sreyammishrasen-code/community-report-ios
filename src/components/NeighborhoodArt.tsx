import { Platform, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { colors } from "../theme";

/** Decorative neighborhood illustration, not live geographic data. */
export function NeighborhoodArt() {
  return (
    <View
      style={styles.frame}
      accessible
      accessibilityLabel="Illustration of a neighborhood map with a location pin and a check mark"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 342 235"
        {...(Platform.OS === "web"
          ? { "aria-hidden": true }
          : { accessible: false })}
      >
        <Rect width={342} height={235} fill="#E7ECDF" />
        <Rect x={8} y={18} width={92} height={70} rx={12} fill="#D5E1C9" />
        <Rect x={216} y={120} width={134} height={130} rx={24} fill="#D5E1C9" />
        <Path
          d="M-20 180 362 5M-30 50 372 220M122 -10 204 245"
          stroke="white"
          strokeWidth={17}
        />
        <Path
          d="M-20 180 362 5M-30 50 372 220M122 -10 204 245"
          stroke="#D6DACF"
          strokeWidth={1}
        />
        <SvgText
          x={17}
          y={36}
          fontSize={9}
          fill="#687F62"
          fontWeight="600"
          letterSpacing={1}
        >
          PARK
        </SvgText>
        <SvgText
          x={221}
          y={52}
          fontSize={10}
          fill="#687F62"
          transform="rotate(-26 221 52)"
        >
          Your neighborhood
        </SvgText>
        <Circle cx={171} cy={118} r={67} fill={colors.forest} />
        <G
          transform="translate(146 82)"
          stroke="white"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M45 20c0 17-20 37-20 37S5 37 5 20a20 20 0 1 1 40 0Z" />
          <Circle cx={25} cy={20} r={7} />
        </G>
        <Rect
          x={181}
          y={149}
          width={53}
          height={53}
          rx={18}
          fill={colors.peach}
        />
        <Path
          d="m196 176 8 8 15-19"
          fill="none"
          stroke={colors.forest}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    aspectRatio: 342 / 235,
    borderRadius: 22,
    overflow: "hidden",
  },
});
