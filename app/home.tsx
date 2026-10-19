import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, sharedStyles } from "../src/components/Controls";
import { Icon } from "../src/components/Icon";
import { Screen } from "../src/components/Screen";
import { ErrorNote, Header, Nav, Note, Row, Title } from "../src/components/UI";
import { categoryName, addressText, statusLabel } from "../src/domain";
import { useStore } from "../src/store";
import { colors } from "../src/theme";

export default function HomeScreen() {
  const router = useRouter();
  const store = useStore();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await store.create();
      router.push({
        pathname: "/report/[id]",
        params: { id: r.id, phase: "access" },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const drafts = store.state.reports.filter(
    (r) => r.status === "draft" && !r.archived,
  );
  const recent = store.state.reports
    .filter((r) => r.status !== "draft" && !r.archived)
    .slice(0, 3);
  return (
    <Screen footer={<Nav active="home" />}>
      <Header title="MONTGOMERY COUNTY" back={() => router.replace("/")} />
      <Title sub="One report can make a difference.">
        Your neighborhood,{"\n"}a little better.
      </Title>
      <View style={styles.hero}>
        <Icon name="spark" size={32} color={colors.mint} />
        <Text style={styles.heroTitle}>Something needs fixing?</Text>
        <Text style={styles.heroBody}>
          A photo and a few words are enough to get your report started.
        </Text>
        <Button
          label={busy ? "Creating draft…" : "Report an issue"}
          onPress={start}
          disabled={busy || !!store.storageError}
          light
          arrow
          testID="report-issue"
        />
      </View>
      <ErrorNote message={error} />
      <View style={styles.section}>
        <Text style={sharedStyles.eyebrow}>PICK UP WHERE YOU LEFT OFF</Text>
        {drafts.length ? (
          drafts.slice(0, 2).map((r) => (
            <Row
              key={r.id}
              title={categoryName(r.category)}
              subtitle={
                addressText(r.location) || "Saved on this device · not sent"
              }
              icon="edit"
              onPress={() =>
                router.push({
                  pathname: "/report/[id]",
                  params: { id: r.id },
                })
              }
            />
          ))
        ) : (
          <Note>
            No drafts yet. Your report is saved as you go—even offline.
          </Note>
        )}
      </View>
      {recent.length > 0 && (
        <View style={styles.section}>
          <Text style={sharedStyles.eyebrow}>RECENT ACTIVITY</Text>
          {recent.map((r) => (
            <Row
              key={r.id}
              title={categoryName(r.category)}
              subtitle={statusLabel(r)}
              icon="list"
              onPress={() =>
                router.push({ pathname: "/report/[id]", params: { id: r.id } })
              }
            />
          ))}
        </View>
      )}
      <Text style={[sharedStyles.body, { fontSize: 12, marginVertical: 18 }]}>
        Independent app · not affiliated with Montgomery County. For immediate
        danger, call 911. County submission is completed on the official site.
      </Text>
    </Screen>
  );
}
const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.forest,
    borderRadius: 24,
    padding: 24,
    gap: 22,
  },
  heroTitle: { color: colors.white, fontSize: 23, fontWeight: "600" },
  heroBody: { color: colors.onForest, fontSize: 15, lineHeight: 24 },
  section: { marginTop: 28, gap: 14 },
});
