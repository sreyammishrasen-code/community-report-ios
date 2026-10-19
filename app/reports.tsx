import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Screen } from "../src/components/Screen";
import { Nav, Note, Row, Title, ui } from "../src/components/UI";
import { useStore } from "../src/store";
import { addressText, categoryName, statusLabel } from "../src/domain";
import { colors } from "../src/theme";
export default function ReportsScreen() {
  const store = useStore();
  const router = useRouter();
  const [filter, setFilter] = useState("Drafts");
  const reports = store.state.reports.filter((r) =>
    filter === "Archived"
      ? r.archived
      : !r.archived &&
        (filter === "Drafts" ? r.status === "draft" : r.status !== "draft"),
  );
  return (
    <Screen footer={<Nav active="reports" />}>
      <Title sub="A private record of the things you’ve noticed.">
        My reports
      </Title>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: colors.border,
          borderRadius: 14,
          padding: 4,
          marginBottom: 24,
        }}
      >
        {["Drafts", "Follow-up", "Archived"].map((f) => (
          <Pressable
            key={f}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 11,
              backgroundColor: filter === f ? colors.white : "transparent",
            }}
          >
            <Text
              style={{
                color: colors.forest,
                textAlign: "center",
                fontWeight: "600",
              }}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </View>
      {!reports.length && (
        <Note>
          {filter === "Drafts"
            ? "Your first report starts here. Notice something that needs attention? Start from Home."
            : `No ${filter.toLowerCase()} reports yet.`}
        </Note>
      )}
      {reports.map((r) => (
        <Row
          key={r.id}
          title={categoryName(r.category)}
          subtitle={`${statusLabel(r)}\n${addressText(r.location) || "Location not added"}\nUpdated ${new Date(r.updatedAt).toLocaleDateString()}`}
          icon={r.status === "draft" ? "edit" : "list"}
          onPress={() =>
            router.push({ pathname: "/report/[id]", params: { id: r.id } })
          }
        />
      ))}
      <Row
        title="Report another issue"
        subtitle="Start with a photo or a few words"
        icon="camera"
        onPress={() => router.replace("/home")}
      />
      <Text style={ui.small}>
        County status is not synchronized. Receipts captured from MC311 are
        labeled separately from numbers entered manually. Archiving is only a
        personal filing choice, not county closure.
      </Text>
    </Screen>
  );
}
