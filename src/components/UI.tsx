import { useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { colors } from "../theme";
import { Icon, type IconName } from "./Icon";
import { sharedStyles } from "./Controls";

export function Header({
  title,
  back,
  right,
}: {
  title: string;
  back?: () => void;
  right?: ReactNode;
}) {
  const router = useRouter();
  return (
    <View style={ui.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={
          back ??
          (() => (router.canGoBack() ? router.back() : router.replace("/home")))
        }
        style={ui.hit}
      >
        <Icon name="back" />
      </Pressable>
      <Text style={ui.headerText}>{title}</Text>
      {right ?? <View style={ui.hit} />}
    </View>
  );
}
export function Title({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: string;
}) {
  return (
    <View style={ui.title}>
      <Text accessibilityRole="header" style={sharedStyles.heading}>
        {children}
      </Text>
      {sub && <Text style={[sharedStyles.body, { marginTop: 12 }]}>{sub}</Text>}
    </View>
  );
}
export function Note({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <View style={[ui.note, warning && { backgroundColor: "#F5E8D1" }]}>
      <Text style={ui.noteText}>{children}</Text>
    </View>
  );
}
export function ErrorNote({ message }: { message?: string | null }) {
  return message ? (
    <View style={[ui.note, { backgroundColor: "#F4E5DE" }]}>
      <Text
        accessibilityRole="alert"
        style={{ color: "#8F302C", lineHeight: 22 }}
      >
        {message}
      </Text>
    </View>
  ) : null;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={ui.field}>
      <Text style={sharedStyles.eyebrow}>{label.toUpperCase()}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        maxLength={200}
        {...props}
        style={[
          ui.input,
          props.multiline && { minHeight: 130, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Row({
  title,
  subtitle,
  icon = "chevron",
  onPress,
  selected,
  disabled,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.row,
        selected && { backgroundColor: colors.mint },
        (pressed || disabled) && { opacity: 0.65 },
      ]}
    >
      <Icon name={icon} />
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={ui.rowTitle}>{title}</Text>
        {subtitle && <Text style={ui.small}>{subtitle}</Text>}
      </View>
      <Icon name={selected ? "check" : "chevron"} size={18} />
    </Pressable>
  );
}
export function TextLink({
  label,
  onPress,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={sharedStyles.link}
    >
      <Text style={[sharedStyles.linkText, danger && { color: "#A7433E" }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Progress({ step }: { step: number }) {
  return (
    <View
      accessibilityLabel={`Step ${step} of 3`}
      style={{ flexDirection: "row", gap: 6, marginVertical: 18 }}
    >
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={{
            height: 3,
            flex: 1,
            backgroundColor: n <= step ? colors.forest : colors.border,
          }}
        />
      ))}
    </View>
  );
}
export function Nav({ active }: { active: "home" | "reports" | "you" }) {
  const router = useRouter();
  return (
    <View accessibilityLabel="Main navigation" style={ui.nav}>
      {(
        [
          { id: "home", label: "Home", icon: "home" },
          { id: "reports", label: "My reports", icon: "list" },
          { id: "you", label: "You", icon: "user" },
        ] as const
      ).map((t) => (
        <Pressable
          key={t.id}
          accessibilityRole="tab"
          accessibilityLabel={t.label}
          accessibilityState={{ selected: t.id === active }}
          onPress={() => router.replace(`/${t.id}` as Href)}
          style={ui.navItem}
        >
          <Icon
            name={t.icon}
            color={t.id === active ? colors.forest : colors.muted}
          />
          <Text
            style={[
              ui.small,
              t.id === active && { fontWeight: "700", color: colors.forest },
            ]}
          >
            {t.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export async function openLink(url: string) {
  await Linking.openURL(url);
}
export const ui = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginHorizontal: -10,
  },
  hit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "600",
    color: colors.forest,
  },
  title: { marginTop: 24, marginBottom: 24 },
  note: {
    backgroundColor: colors.mint,
    padding: 18,
    borderRadius: 18,
    marginVertical: 12,
  },
  noteText: { color: colors.forest, fontSize: 14, lineHeight: 23 },
  field: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.white,
    marginBottom: 14,
    gap: 6,
  },
  input: {
    fontSize: 16,
    color: colors.forest,
    minHeight: 38,
    paddingVertical: 6,
  },
  row: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 17,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 80,
  },
  rowTitle: { color: colors.forest, fontSize: 16, fontWeight: "600" },
  small: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    gap: 12,
  },
  actions: { gap: 12, marginTop: 20, marginBottom: 12 },
  photo: {
    height: 230,
    width: "100%",
    borderRadius: 20,
    backgroundColor: colors.mint,
  },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: colors.paper,
  },
  navItem: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
});
