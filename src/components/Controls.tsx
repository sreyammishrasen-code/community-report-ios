import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "../theme";
import { Icon } from "./Icon";

export function Button({
  label,
  onPress,
  light = false,
  arrow = false,
  testID,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  light?: boolean;
  arrow?: boolean;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        light && styles.light,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, light && styles.darkText]}>{label}</Text>
      {arrow && (
        <Icon
          name="arrow"
          size={22}
          color={light ? colors.forest : colors.white}
        />
      )}
    </Pressable>
  );
}

export function Badge({
  label,
  style,
}: {
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  heading: {
    color: colors.forest,
    fontSize: 30,
    fontWeight: "600",
    letterSpacing: -0.8,
    lineHeight: 37,
  },
  body: { color: colors.muted, fontSize: 15, lineHeight: 24 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted,
    letterSpacing: 1.1,
  },
  link: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  linkText: { color: colors.forest, fontWeight: "600", fontSize: 14 },
  pressed: { opacity: 0.7 },
});

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.forest,
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 21,
    paddingVertical: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  light: { backgroundColor: colors.white },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  darkText: { color: colors.forest },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    backgroundColor: colors.mint,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    color: colors.forest,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
