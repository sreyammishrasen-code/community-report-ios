import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Platform, Switch, Text, View } from "react-native";
import { Button, sharedStyles } from "../src/components/Controls";
import { Screen } from "../src/components/Screen";
import {
  ErrorNote,
  Field,
  Header,
  Nav,
  Note,
  Row,
  TextLink,
  Title,
  ui,
} from "../src/components/UI";
import { contactError, emptyContact } from "../src/domain";
import { checkConnection, connectionError } from "../src/api";
import { useStore } from "../src/store";

type Section =
  | "main"
  | "profile"
  | "privacy"
  | "notifications"
  | "language"
  | "delete"
  | "connection";
export default function YouScreen() {
  const store = useStore();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<Section>(
    params.section === "connection" ? "connection" : "main",
  );
  const [contact, setContact] = useState(store.profile ?? emptyContact);
  const [connection, setConnection] = useState(store.connection);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  const go = (next: Section) => {
    setError("");
    setNotice("");
    setSection(next);
  };
  const task = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen
      key={section}
      footer={section === "main" ? <Nav active="you" /> : undefined}
    >
      {section !== "main" && (
        <Header title={section.toUpperCase()} back={() => go("main")} />
      )}
      <ErrorNote message={error} />
      {notice ? <Note>{notice}</Note> : null}
      {section === "main" && (
        <>
          <Title sub="Your preferences. Your device. No account required.">
            You
          </Title>
          <Row
            title={
              store.profile
                ? `${store.profile.firstName} ${store.profile.lastName}`
                : "Your contact details"
            }
            subtitle={
              store.profile?.email || "Optional reusable profile for MC311"
            }
            icon="user"
            onPress={() => go("profile")}
          />
          <Text style={[sharedStyles.eyebrow, { marginVertical: 20 }]}>
            PREFERENCES
          </Text>
          <Row
            title="AI connection"
            subtitle={
              store.connection.url
                ? "Backend configured · tap to test or edit"
                : "Optional · enable photo analysis and transcription"
            }
            icon="spark"
            onPress={() => go("connection")}
          />
          <Row
            title="Report updates"
            subtitle="County status synchronization is not connected"
            icon="bell"
            onPress={() => go("notifications")}
          />
          <Row
            title="Language"
            subtitle="English"
            icon="globe"
            onPress={() => go("language")}
          />
          <Text style={[sharedStyles.eyebrow, { marginVertical: 20 }]}>
            YOUR DATA
          </Text>
          <Row
            title="Privacy & storage"
            subtitle="What stays here and what gets shared"
            icon="shield"
            onPress={() => go("privacy")}
          />
          <Row
            title="Delete app data"
            subtitle="Clear this device’s reports, photos and saved details"
            icon="trash"
            onPress={() => go("delete")}
          />
          <Text style={ui.small}>
            MoCo Report · 0.1.0 · Independent community app, not an official
            county service.
          </Text>
        </>
      )}
      {section === "profile" && (
        <>
          <Title>How can we reach you?</Title>
          {(["firstName", "lastName", "email", "phone"] as const).map(
            (key, i) => (
              <Field
                key={key}
                label={
                  ["First name", "Last name", "Email", "Phone · optional"][i]
                }
                value={contact[key]}
                maxLength={key === "email" ? 254 : key === "phone" ? 30 : 80}
                autoCapitalize={key === "email" ? "none" : "words"}
                keyboardType={
                  key === "email"
                    ? "email-address"
                    : key === "phone"
                      ? "phone-pad"
                      : "default"
                }
                onChangeText={(value) =>
                  setContact({ ...contact, [key]: value })
                }
              />
            ),
          )}
          <Note>
            Saved on this device for future reports. Updating this profile does
            not alter existing report snapshots or county records.
          </Note>
          <Button
            label="Save contact details"
            disabled={busy}
            onPress={() =>
              task(async () => {
                const c = {
                  firstName: contact.firstName.trim(),
                  lastName: contact.lastName.trim(),
                  email: contact.email.trim(),
                  phone: contact.phone.trim(),
                };
                const invalid = contactError(c);
                if (invalid) throw new Error(invalid);
                await store.saveProfile(c);
                go("main");
              })
            }
          />
          <TextLink
            label="Remove reusable contact profile"
            danger
            onPress={() =>
              task(async () => {
                await store.saveProfile(undefined);
                setContact(emptyContact);
                setNotice(
                  "Reusable profile removed. Existing report snapshots are unchanged.",
                );
              })
            }
          />
        </>
      )}
      {section === "connection" && (
        <>
          <Title sub="For the app owner or a trusted test device.">
            Connect the AI service.
          </Title>
          <Note>
            Run the included Node.js backend and enter its address and access
            token here. Never put an OpenAI API key in the app. On a phone, use
            your computer’s Wi-Fi address instead of localhost (for example,
            http://192.168.0.103:3001).
          </Note>
          <Field
            label="Backend URL"
            autoCapitalize="none"
            autoCorrect={false}
            value={connection.url}
            maxLength={250}
            placeholder={
              Platform.OS === "web"
                ? "https://api.example.com"
                : "http://192.168.0.103:3001"
            }
            onChangeText={(url) => setConnection({ ...connection, url })}
          />
          <Field
            label="Backend access token"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={connection.token}
            maxLength={200}
            onChangeText={(token) => setConnection({ ...connection, token })}
          />
          <Button
            label={busy ? "Checking…" : "Test and save connection"}
            disabled={busy}
            onPress={() =>
              task(async () => {
                const c = {
                  url: connection.url.trim().replace(/\/$/, ""),
                  token: connection.token.trim(),
                };
                const invalid = connectionError(c);
                if (invalid) throw new Error(invalid);
                const health = await checkConnection(c);
                await store.saveConnection(c);
                setNotice(
                  health.aiAvailable
                    ? "Connected. AI is available; each report still requires your consent."
                    : "Connected, but the backend needs an OpenAI API key. Manual reporting is available.",
                );
              })
            }
          />
          <TextLink
            label="Disconnect AI service"
            onPress={() =>
              task(async () => {
                await store.saveConnection({ url: "", token: "" });
                setConnection({ url: "", token: "" });
                await store.preferences({ aiConsent: false });
                setNotice("Disconnected. Reports stay on this device.");
              })
            }
          />
          <Note warning>
            For public distribution, deploy HTTPS with per-user authentication
            and abuse controls. This development token is suitable only for a
            trusted pilot. On a phone, localhost means the phone—not your
            computer.
          </Note>
          {params.section === "connection" && (
            <TextLink
              label="Return to my report"
              onPress={() => router.back()}
            />
          )}
        </>
      )}
      {section === "privacy" && (
        <>
          <Title>Your report. Your choice.</Title>
          <View style={ui.card}>
            <Text style={ui.rowTitle}>On this device</Text>
            <Text style={sharedStyles.body}>
              Drafts, report snapshots, incident location and photos are stored
              until you delete app data. Report snapshots include any contact
              details you added. They are in app-private storage, not separately
              encrypted by this app. Device backups may contain copies.
            </Text>
            <Text style={sharedStyles.body}>
              {Platform.OS === "web"
                ? "This browser uses local storage for reports, profile and the backend token. Avoid shared browsers; clearing site storage removes these records."
                : "The reusable contact profile and backend token use the device secure store. Photos use app-private file storage."}
            </Text>
          </View>
          <View style={ui.card}>
            <Text style={ui.rowTitle}>Optional AI preparation</Text>
            <Text style={sharedStyles.body}>
              With your consent, your description and selected photo pass
              through your configured backend to OpenAI. Audio is sent for
              transcription. Contact fields and GPS are excluded from the AI
              request, but anything you say or include in a photo may contain
              personal information.
            </Text>
            <Text style={sharedStyles.body}>
              The included backend does not intentionally persist report
              payloads or audio. It processes uploads in memory. OpenAI may
              retain API data under its policies; this app does not promise zero
              provider retention. Hosting providers may maintain network logs.
            </Text>
          </View>
          <View style={ui.card}>
            <Text style={ui.rowTitle}>Shared with MC311</Text>
            <Text style={sharedStyles.body}>
              Only after you review the report, consent, and press Send or
              choose the official-site handoff. Supported native reports are
              entered into the county form and submitted; contact details,
              incident location, description and the selected photo may be sent.
              County records follow county policies. Deleting this app’s data
              does not retract a county request.
            </Text>
          </View>
          <Note>
            There is no background GPS tracking. Raw audio is temporary: it is
            discarded after successful transcription or when leaving capture.
            Failed transcription must be retried before leaving that screen.
          </Note>
          <View style={ui.row}>
            <Text style={[ui.noteText, { flex: 1 }]}>
              Allow optional AI preparation
            </Text>
            <Switch
              accessibilityLabel="Allow optional AI preparation"
              value={store.state.preferences.aiConsent}
              onValueChange={(aiConsent) =>
                task(() => store.preferences({ aiConsent }))
              }
            />
          </View>
          <Button label="Manage app data" light onPress={() => go("delete")} />
        </>
      )}
      {section === "notifications" && (
        <>
          <Title>Know what’s confirmed.</Title>
          <Note>
            Automatic county-status updates are not connected. We won’t request
            notification permission or send misleading repair notifications.
          </Note>
          <Text style={sharedStyles.body}>
            Use the official county website or your confirmation email to check
            a request. Your local timeline records app actions, not live county
            status. Notification delivery will be enabled only after a reliable
            status integration is available.
          </Text>
          <View style={ui.actions}>
            <Button
              label="View my reports"
              onPress={() => router.replace("/reports")}
            />
          </View>
        </>
      )}
      {section === "language" && (
        <>
          <Title>Report in your own words.</Title>
          <Row
            title="English"
            subtitle="Current app language"
            icon="check"
            selected
            onPress={() => {}}
          />
          <Note>
            Spanish interface translation is planned for a later release, as in
            the design. You can edit all descriptions and AI suggestions before
            county submission.
          </Note>
          <Button label="Done" onPress={() => go("main")} />
        </>
      )}
      {section === "delete" && (
        <>
          <Title>Delete your app data?</Title>
          <Note warning>
            This permanently removes all local drafts, photos, report history,
            saved contact details and the backend token from this app. It does
            not cancel county requests, erase county records, clear your
            clipboard, or delete copies you exported or backed up.
          </Note>
          <Text style={sharedStyles.body}>
            There are {store.state.reports.length} reports on this device. Share
            any summaries or photos you want to keep before deleting.
          </Text>
          <Field
            label="Type DELETE to confirm"
            value={confirm}
            onChangeText={setConfirm}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <View style={ui.actions}>
            <Button label="Keep my data" onPress={() => go("main")} />
            <Button
              label={busy ? "Deleting…" : "Delete app data permanently"}
              disabled={busy || confirm !== "DELETE"}
              onPress={() =>
                task(async () => {
                  await store.clear();
                  router.replace("/");
                })
              }
            />
          </View>
        </>
      )}
    </Screen>
  );
}
