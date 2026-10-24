import { Pressable, StyleSheet, Text } from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { colors } from "../theme";
import { Icon } from "./Icon";
import { Row } from "./UI";

export function DraftRow({
  title,
  subtitle,
  onPress,
  onDelete,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  onDelete: () => void;
}) {
  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${title} draft`}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.deleteAction,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="trash" color={colors.white} size={20} />
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      )}
    >
      <Row title={title} subtitle={subtitle} icon="edit" onPress={onPress} />
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  deleteAction: {
    width: 92,
    minHeight: 80,
    marginBottom: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#A7433E",
    borderRadius: 18,
  },
  deleteText: { color: colors.white, fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.72 },
});
