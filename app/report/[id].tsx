import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Platform,
  Share,
  Switch,
  Text,
  View,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { Screen } from "../../src/components/Screen";
import { Badge, Button, sharedStyles } from "../../src/components/Controls";
import {
  ErrorNote,
  Field,
  Header,
  Note,
  Progress,
  Row,
  TextLink,
  Title,
  ui,
} from "../../src/components/UI";
import { Icon } from "../../src/components/Icon";
import { IssueMap } from "../../src/components/IssueMap";
import { VoiceCapture } from "../../src/components/VoiceCapture";
import { CountyPortal } from "../../src/components/CountyPortal";
import {
  addressText,
  categories,
  categoryName,
  contactError,
  emptyContact,
  locationError,
  reviewError,
  saveReceipt,
  confirmCountySubmission,
  statusLabel,
  summary,
  COUNTY_URL,
  type Contact,
  type IssueLocation,
  type Report,
} from "../../src/domain";
import {
  automationError,
  COUNTY_STATUS_URL,
  destination,
} from "../../src/county";
import { analyze } from "../../src/api";
import { keepPhoto, removePhoto } from "../../src/media";
import { useStore } from "../../src/store";
import { colors } from "../../src/theme";
import { withTimeout } from "../../src/async";

type Phase =
  | "access"
  | "capture"
  | "location"
  | "preparing"
  | "clarify"
  | "categories"
  | "review"
  | "contact"
  | "confirm"
  | "sending"
  | "uncertain"
  | "success"
  | "handoff"
  | "receipt"
  | "detail"
  | "summary"
  | "saved"
  | "urgent"
  | "jurisdiction";
export default function ReportRoute() {
  const { id, phase } = useLocalSearchParams<{ id: string; phase?: string }>();
  const store = useStore();
  const router = useRouter();
  const report = store.state.reports.find((r) => r.id === id);
  if (!report)
    return (
      <Screen>
        <Title>Report not found.</Title>
        <Note>
          This report may have been deleted, or belongs to a different device.
        </Note>
        <Button
          label="Back to my reports"
          onPress={() => router.replace("/reports")}
        />
      </Screen>
    );
  return (
    <ReportFlow
      key={id}
      report={report}
      first={
        report.status === "draft"
          ? phase === "access"
            ? "access"
            : "capture"
          : "detail"
      }
    />
  );
}
function ReportFlow({ report, first }: { report: Report; first: Phase }) {
  const store = useStore();
  const router = useRouter();
  const r = report;
  const latest = useRef(r);
  latest.current = r;
  const [phase, setPhase] = useState<Phase>(first);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [clarification, setClarification] = useState("");
  const [answer, setAnswer] = useState("");
  const [contact, setContact] = useState<Contact>(
    r.contact ?? store.profile ?? emptyContact,
  );
  const [remember, setRemember] = useState(!!store.profile);
  const [receipt, setReceipt] = useState(r.receipt ?? "");
  const [shareConsent, setShareConsent] = useState(false);
  const [notice, setNotice] = useState("");
  const [submissionIssue, setSubmissionIssue] = useState("");
  const [portal, setPortal] = useState(false);
  const [sendProgress, setSendProgress] = useState<
    Record<"request" | "photo" | "receipt", string>
  >({
    request: "Waiting to create the MC311 request.",
    photo: r.photo
      ? "Begins after the request is created."
      : "No photo selected.",
    receipt: "Your request number will be saved here.",
  });
  const locked = busy || voiceBusy;
  const actionLock = useRef(false);
  const submissionLock = useRef(false);
  const go = (next: Phase) => {
    setError("");
    setNotice("");
    setPhase(next);
  };
  const back = () => {
    if (locked || phase === "sending") return;
    const parents: Partial<Record<Phase, Phase>> = {
      location: "capture",
      categories: "review",
      clarify: "review",
      review: "location",
      contact: "review",
      confirm: "review",
      receipt: "detail",
      summary: "detail",
      urgent: "capture",
      jurisdiction: "location",
      handoff: "detail",
      success: "detail",
      uncertain: "detail",
    };
    if (parents[phase]) go(parents[phase]!);
    else router.replace("/reports");
  };
  useEffect(
    () =>
      NetInfo.addEventListener((s) =>
        setOnline(s.isConnected !== false && s.isInternetReachable !== false),
      ),
    [],
  );
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      back();
      return true;
    });
    return () => listener.remove();
  }, [phase, locked]);
  const patch = async (fields: Partial<Report>) => {
    const next = {
      ...latest.current,
      ...fields,
      updatedAt: new Date().toISOString(),
    };
    latest.current = next;
    await store.put(next);
    return next;
  };
  const edit = (fields: Partial<Report>) => {
    void patch(fields).catch((e) => setError(e.message));
  };
  const loc = (fields: Partial<IssueLocation>) =>
    edit({ location: { ...latest.current.location, ...fields } });
  const task = async (fn: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Your draft is still here.",
      );
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  const photo = async (camera: boolean) =>
    task(async () => {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted)
          throw new Error(
            "Camera access is off. Choose an existing photo or describe the issue with text. You can change camera access in device settings.",
          );
      }
      const result = await (
        camera
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync
      )({
        mediaTypes: ["images"],
        quality: 0.8,
        exif: false,
        allowsEditing: true,
      });
      if (result.canceled) return;
      const old = latest.current.photo;
      const uri = await keepPhoto(result.assets[0].uri, r.id);
      await patch({ photo: uri });
      await removePhoto(old);
    });
  const gps = () =>
    task(async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Location access is off. Enter the address or intersection manually.",
        );
      const position = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        20000,
        "Location took too long. Try again outdoors, or enter the address manually.",
      );
      let fields: Partial<IssueLocation> = {};
      if (Platform.OS !== "web") {
        try {
          const [address] = await withTimeout(
            Location.reverseGeocodeAsync(position.coords),
            10000,
            "Address lookup timed out.",
          );
          if (address)
            fields = {
              number: address.streetNumber ?? "",
              street: address.street ?? "",
              streetType: "",
              city: address.city ?? address.subregion ?? "",
            };
        } catch {
          setNotice(
            "GPS received. Address lookup was unavailable; enter the street and city below.",
          );
        }
      }
      await patch({
        location: {
          ...latest.current.location,
          ...fields,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          confirmed: false,
        },
      });
    });
  const prepare = () =>
    task(async () => {
      const invalid = locationError(latest.current.location);
      if (invalid) throw new Error(invalid);
      if (r.location.jurisdiction === "other") {
        go("jurisdiction");
        return;
      }
      if (
        !store.state.preferences.aiConsent ||
        !store.connection.url ||
        !online
      ) {
        go("categories");
        return;
      }
      go("preparing");
      try {
        const result = await analyze(store.connection, latest.current);
        await patch({
          originalDescription: latest.current.description,
          description: result.description,
          category: result.category,
          source: "ai",
        });
        if (result.clarification) {
          setClarification(result.clarification);
          go("clarify");
        } else go("review");
      } catch (e) {
        go("categories");
        setError(
          `AI preparation unavailable. ${(e as Error).message} Choose a category to keep going; your original input is preserved.`,
        );
      }
    });
  const save = () =>
    task(async () => {
      await store.flush();
      go("saved");
    });
  const readyToSend = () => {
    const invalid = reviewError(r);
    if (invalid) {
      setError(invalid);
      return;
    }
    go("contact");
  };
  const saveContact = () =>
    task(async () => {
      const normalized = {
        firstName: contact.firstName.trim(),
        lastName: contact.lastName.trim(),
        email: contact.email.trim(),
        phone: contact.phone.trim(),
      };
      const invalid = contactError(normalized);
      if (invalid) throw new Error(invalid);
      await patch({ contact: normalized });
      await store.saveProfile(remember ? normalized : undefined);
      go("confirm");
    });
  const beginSubmission = () =>
    task(async () => {
      if (!shareConsent)
        throw new Error(
          "Confirm that you want to send these details to MC311.",
        );
      const current = latest.current;
      const invalid =
        reviewError(current) || contactError(current.contact ?? emptyContact);
      if (invalid) throw new Error(invalid);
      if (!online) {
        go("saved");
        return;
      }
      const unsupported = automationError(current);
      if (Platform.OS === "web" || unsupported) {
        const now = new Date().toISOString();
        await patch({
          status: "handoff",
          timeline: [
            ...current.timeline.slice(-199),
            {
              at: now,
              text: "Prepared county-site handoff; submission not confirmed",
            },
          ],
        });
        go("handoff");
        if (unsupported)
          setNotice(`${unsupported} Continue on the official county website.`);
        return;
      }
      const now = new Date().toISOString();
      await patch({
        status: "sending",
        timeline: [
          ...current.timeline.slice(-199),
          { at: now, text: "Automatic MC311 submission started by you" },
        ],
      });
      go("sending");
    });
  const submissionFailed = (message: string) => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    void (async () => {
      const now = new Date().toISOString();
      await patch({
        status: "handoff",
        timeline: [
          ...latest.current.timeline.slice(-199),
          { at: now, text: "Automatic submission could not be confirmed" },
        ],
      });
      go("handoff");
      setError(message);
    })()
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        submissionLock.current = false;
      });
  };
  const submissionUncertain = (message: string) => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    void (async () => {
      const now = new Date().toISOString();
      await patch({
        status: "sending",
        timeline: [
          ...latest.current.timeline.slice(-199),
          {
            at: now,
            text: "MC311 response did not include a readable receipt; verification needed",
          },
        ],
      });
      setSubmissionIssue(message);
      go("uncertain");
    })()
      .catch((e) => setError((e as Error).message))
      .finally(() => {
        submissionLock.current = false;
      });
  };
  const submissionCompleted = (result: {
    receipt: string;
    photoStatus: "none" | "pending" | "attached";
  }) => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    void store
      .put(
        confirmCountySubmission(
          latest.current,
          result.receipt,
          result.photoStatus,
        ),
      )
      .then(() => go("success"))
      .catch((e) => {
        go("detail");
        setError(
          `MC311 returned receipt ${result.receipt}, but it could not be saved: ${e.message}`,
        );
      })
      .finally(() => {
        submissionLock.current = false;
      });
  };
  const bodyPhoto = r.photo ? (
    <Image
      source={{ uri: r.photo }}
      accessibilityLabel="Your issue photo"
      style={ui.photo}
    />
  ) : (
    <View
      style={[
        ui.photo,
        { alignItems: "center", justifyContent: "center", gap: 16 },
      ]}
    >
      <Icon name="camera" size={42} />
      <Text style={sharedStyles.body}>Add a photo, or report with text.</Text>
    </View>
  );
  const switchRow = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
  ) => (
    <View style={[ui.row, { backgroundColor: colors.mint }]}>
      <Text style={[ui.noteText, { flex: 1 }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        disabled={locked}
        trackColor={{ true: colors.forest }}
      />
    </View>
  );
  const details = (
    <>
      {bodyPhoto}
      <View style={[ui.card, { marginTop: 20 }]}>
        <Badge label={categoryName(r.category)} />
        <Text style={ui.rowTitle}>{addressText(r.location)}</Text>
        <Text style={sharedStyles.body}>{r.location.note}</Text>
        <Text style={[sharedStyles.body, { color: colors.forest }]}>
          {r.description}
        </Text>
        {r.contact && (
          <Text style={ui.small}>
            {r.contact.firstName} {r.contact.lastName}
            {"\n"}
            {r.contact.email}
            {r.contact.phone ? `\n${r.contact.phone}` : ""}
          </Text>
        )}
      </View>
    </>
  );
  return (
    <Screen key={phase}>
      <Header
        title={
          phase === "detail"
            ? "REPORT DETAILS"
            : phase === "confirm"
              ? "REVIEW REPORT"
              : phase === "sending"
                ? "SENDING REPORT"
                : phase === "uncertain"
                  ? "CHECKING YOUR REPORT"
                  : phase === "success"
                    ? "REPORT RECEIVED"
                    : "YOUR REPORT"
        }
        back={back}
      />
      {!online && (
        <Note warning>
          You’re offline. Drafts remain on this device. Nothing will be sent
          automatically when you reconnect.
        </Note>
      )}
      <ErrorNote message={error} />
      {notice ? <Note>{notice}</Note> : null}
      {busy && phase !== "preparing" && (
        <ActivityIndicator color={colors.forest} accessibilityLabel="Working" />
      )}
      {phase === "access" && (
        <>
          <Title sub="Choose what to share. You don’t need an account.">
            Before your first report.
          </Title>
          <Row
            title="Camera"
            subtitle="Photograph the issue, not bystanders."
            icon="camera"
            onPress={() => go("capture")}
          />
          <Row
            title="Microphone"
            subtitle="Optional. An AI service turns a short recording into editable text."
            icon="mic"
            onPress={() => go("capture")}
          />
          <Row
            title="Location"
            subtitle="Only when you ask. Confirm the incident location, not just your phone’s position."
            icon="pin"
            onPress={() => go("capture")}
          />
          <Note>
            Your photo and words stay on this device unless you choose AI
            preparation or share with the county. Raw recordings are temporary
            and are removed after transcription or when leaving capture.
          </Note>
          <Button label="Start my report" onPress={() => go("capture")} />
        </>
      )}
      {phase === "capture" && (
        <>
          <Progress step={1} />
          {bodyPhoto}
          <View style={ui.actions}>
            <Button
              label={r.photo ? "Retake photo" : "Take photo"}
              onPress={() => photo(true)}
              disabled={locked}
            />
            <Button
              label="Choose from photos"
              light
              onPress={() => photo(false)}
              disabled={locked}
            />
          </View>
          {r.photo && (
            <TextLink
              label="Remove photo"
              onPress={() =>
                task(async () => {
                  const old = r.photo;
                  await patch({ photo: undefined });
                  await removePhoto(old);
                })
              }
            />
          )}
          <Title sub="A sentence is plenty. Your words stay editable.">
            What did you notice?
          </Title>
          <Field
            label="Description"
            value={r.description}
            multiline
            maxLength={2000}
            editable={!locked}
            placeholder="What is damaged? What should the county know?"
            onChangeText={(description) =>
              edit({ description, source: "manual" })
            }
          />
          <Text style={ui.small}>{r.description.length}/2000 characters</Text>
          <Note>
            Optional AI: your photo and description go through your configured
            backend to OpenAI. Voice recordings are sent for transcription.
            Contact details and GPS are not included. AI suggestions can be
            wrong—review them.
          </Note>
          {switchRow(
            "Allow AI preparation and transcription",
            store.state.preferences.aiConsent,
            (value) => {
              void store
                .preferences({ aiConsent: value })
                .catch((e) => setError(e.message));
            },
          )}
          <VoiceCapture
            connection={store.connection}
            enabled={
              store.state.preferences.aiConsent &&
              !!store.connection.url &&
              online
            }
            onText={(text) =>
              edit({
                description: [latest.current.description, text]
                  .filter(Boolean)
                  .join("\n")
                  .slice(0, 2000),
                source: "manual",
              })
            }
            onBusy={setVoiceBusy}
          />
          {!store.connection.url && (
            <TextLink
              label="Set up AI connection"
              onPress={() =>
                router.push({
                  pathname: "/you",
                  params: { section: "connection" },
                })
              }
            />
          )}
          <View style={ui.actions}>
            <Button
              label="Continue to location"
              disabled={
                locked || (!r.photo && r.description.trim().length < 10)
              }
              onPress={() => go("location")}
            />
            <TextLink label="Save draft for later" onPress={save} />
            <TextLink label="Immediate danger?" onPress={() => go("urgent")} />
          </View>
          {error.includes("access") && (
            <TextLink
              label="Open device settings"
              onPress={() => task(() => Linking.openSettings())}
            />
          )}
        </>
      )}
      {phase === "location" && (
        <>
          <Progress step={2} />
          <Title sub="Confirm where the issue is—not just where you’re standing.">
            Is it right here?
          </Title>
          <IssueMap
            location={r.location}
            onPin={(latitude, longitude) =>
              loc({ latitude, longitude, confirmed: false })
            }
          />
          <Button
            label="Use my current location"
            onPress={gps}
            disabled={locked}
            light
          />
          {r.location.accuracy != null && (
            <Text style={[ui.small, { marginVertical: 12 }]}>
              GPS accuracy: about {Math.round(r.location.accuracy)} metres.
              Adjust the pin if needed.
            </Text>
          )}
          <View style={{ marginTop: 20 }}>
            <Row
              title="Street address"
              selected={r.location.kind === "street"}
              onPress={() => loc({ kind: "street", confirmed: false })}
            />
            <Row
              title="Intersection"
              selected={r.location.kind === "intersection"}
              onPress={() => loc({ kind: "intersection", confirmed: false })}
            />
          </View>
          {r.location.kind === "street" && (
            <Field
              label="Nearest building number"
              keyboardType="numbers-and-punctuation"
              value={r.location.number}
              onChangeText={(number) => loc({ number, confirmed: false })}
            />
          )}
          <Field
            label={
              r.location.kind === "street" ? "Street name" : "First street"
            }
            value={r.location.street}
            onChangeText={(street) => loc({ street, confirmed: false })}
          />
          {r.location.kind === "street" ? (
            <Field
              label="Street type (ST, RD, AVE…) · recommended"
              maxLength={10}
              autoCapitalize="characters"
              value={r.location.streetType}
              onChangeText={(streetType) =>
                loc({ streetType, confirmed: false })
              }
            />
          ) : (
            <>
              <Field
                label="First street type (ST, RD, AVE…)"
                maxLength={10}
                autoCapitalize="characters"
                value={r.location.streetType}
                onChangeText={(streetType) =>
                  loc({ streetType, confirmed: false })
                }
              />
              <Field
                label="Cross street name"
                value={r.location.crossStreet}
                onChangeText={(crossStreet) =>
                  loc({ crossStreet, confirmed: false })
                }
              />
              <Field
                label="Cross street type (ST, RD, AVE…)"
                maxLength={10}
                autoCapitalize="characters"
                value={r.location.crossStreetType}
                onChangeText={(crossStreetType) =>
                  loc({ crossStreetType, confirmed: false })
                }
              />
            </>
          )}
          <Field
            label="City or community"
            value={r.location.city}
            onChangeText={(city) => loc({ city, confirmed: false })}
          />
          <Field
            label="Location note · optional"
            value={r.location.note}
            maxLength={400}
            onChangeText={(note) => loc({ note })}
          />
          <Note>
            Road ownership has not been verified. MC311 may refer state,
            municipal, or private-property issues to another authority.
          </Note>
          <Row
            title="This may be outside county responsibility"
            subtitle="State road, another county, or another authority"
            icon="sign"
            selected={r.location.jurisdiction === "other"}
            onPress={() =>
              loc({
                jurisdiction:
                  r.location.jurisdiction === "other" ? "unknown" : "other",
              })
            }
          />
          {switchRow(
            "I confirm this is the issue location",
            r.location.confirmed,
            (confirmed) => loc({ confirmed }),
          )}
          <Button
            label={
              store.state.preferences.aiConsent &&
              store.connection.url &&
              online
                ? "Prepare my report"
                : "Continue to category"
            }
            disabled={locked}
            onPress={prepare}
          />
          <TextLink label="Save draft for later" onPress={save} />
        </>
      )}
      {phase === "preparing" && (
        <>
          <Title sub="You’ll review every detail before anything goes to MC311.">
            Putting it together.
          </Title>
          <View style={{ alignItems: "center", padding: 48, gap: 24 }}>
            <Icon name="spark" size={64} />
            <ActivityIndicator size="large" color={colors.forest} />
          </View>
          <Note>
            Preparing an editable description and choosing a suggested category.
            This does not submit a service request.
          </Note>
        </>
      )}
      {phase === "clarify" && (
        <>
          <Title sub="This detail can help route your report.">
            One quick question.
          </Title>
          <Note>{clarification}</Note>
          <Field
            label="Your answer"
            value={answer}
            onChangeText={setAnswer}
            maxLength={300}
          />
          <Button
            label="Add answer and review"
            onPress={() =>
              task(async () => {
                await patch({
                  description: `${r.description}\n${answer}`
                    .trim()
                    .slice(0, 2000),
                });
                go("review");
              })
            }
            disabled={!answer.trim() || locked}
          />
          <TextLink
            label="I’m not sure · choose a category"
            onPress={() => go("categories")}
          />
        </>
      )}
      {phase === "categories" && (
        <>
          <Progress step={3} />
          <Title sub="Choose the closest match. The county makes the final routing decision.">
            Choose the best fit.
          </Title>
          {categories.map((c) => (
            <Row
              key={c.id}
              title={c.name}
              subtitle={c.hint}
              icon={c.icon}
              selected={r.category === c.id}
              onPress={() =>
                task(async () => {
                  await patch({ category: c.id, source: "manual" });
                  go("review");
                })
              }
            />
          ))}
          <TextLink label="Try AI preparation again" onPress={prepare} />
        </>
      )}
      {phase === "review" && (
        <>
          <Progress step={3} />
          <Title sub="Make sure this says exactly what you observed.">
            Ready for a quick look?
          </Title>
          {bodyPhoto}
          <View style={{ marginTop: 18 }}>
            <Row
              title={categoryName(r.category)}
              subtitle={
                r.source === "ai"
                  ? "AI suggestion · tap to change"
                  : "Your category · tap to change"
              }
              icon="sign"
              onPress={() => go("categories")}
            />
            <Row
              title={addressText(r.location) || "Add issue location"}
              subtitle={r.location.note || "Edit address and pin"}
              icon="pin"
              onPress={() => go("location")}
            />
          </View>
          <Field
            label="Report description"
            multiline
            value={r.description}
            maxLength={2000}
            onChangeText={(description) => edit({ description })}
          />
          {r.originalDescription && r.originalDescription !== r.description && (
            <TextLink
              label="Restore my original words"
              onPress={() =>
                edit({ description: r.originalDescription, source: "manual" })
              }
            />
          )}
          <TextLink
            label="Edit photo or record more"
            onPress={() => go("capture")}
          />
          <Note>
            Destination: MC311. On iOS and Android, the app can create supported
            service requests, try the county photo step, and save the returned
            receipt.
          </Note>
          <Button label="Continue to contact details" onPress={readyToSend} />
          <TextLink label="Save draft for later" onPress={save} />
        </>
      )}
      {phase === "contact" && (
        <>
          <Title sub="These details will accompany the county form. No account needed.">
            How can we reach you?
          </Title>
          {(["firstName", "lastName", "email", "phone"] as const).map(
            (key, i) => (
              <Field
                key={key}
                label={
                  ["First name", "Last name", "Email", "Phone · optional"][i]
                }
                value={contact[key]}
                keyboardType={
                  key === "email"
                    ? "email-address"
                    : key === "phone"
                      ? "phone-pad"
                      : "default"
                }
                autoCapitalize={key === "email" ? "none" : "words"}
                maxLength={key === "email" ? 254 : key === "phone" ? 30 : 80}
                onChangeText={(value) =>
                  setContact({ ...contact, [key]: value })
                }
              />
            ),
          )}
          {switchRow(
            "Remember my contact details on this device",
            remember,
            setRemember,
          )}
          <Note>
            A copy of contact details stays with this report. Turning off
            Remember removes the reusable profile, not report history.
          </Note>
          <Button
            label="Save and review"
            onPress={saveContact}
            disabled={locked}
          />
        </>
      )}
      {phase === "confirm" && (
        <>
          <Title>Looks good?</Title>
          {details}
          <Note>
            {Platform.OS !== "web" && !automationError(r)
              ? `Sent directly to MC311 with your ${r.photo ? "photo, " : ""}incident location and contact details. The app saves the county receipt it receives.`
              : "The official MC311 website will open with the matching service where available."}
          </Note>
          {switchRow(
            `I agree to send my report${r.photo ? ", photo" : ""}, location and contact details to MC311`,
            shareConsent,
            setShareConsent,
          )}
          <Button
            label={
              Platform.OS !== "web" && !automationError(r)
                ? "Send report to MC311"
                : "Continue on MC311"
            }
            onPress={beginSubmission}
            disabled={locked || !shareConsent}
          />
          <TextLink label="Edit report" onPress={() => go("review")} />
        </>
      )}
      {phase === "sending" && (
        <>
          <View style={{ alignItems: "center", paddingTop: 44, gap: 24 }}>
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 36,
                backgroundColor: colors.mint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="arrow" size={58} />
            </View>
            <Title sub="Please keep the app open for a moment.">
              Sending your report.
            </Title>
          </View>
          {(
            [
              ["request", "clock", "Creating MC311 request"],
              ["photo", "image", "Adding your photo"],
              ["receipt", "list", "Saving your receipt"],
            ] as const
          ).map(([key, icon, title]) => (
            <View key={key} style={ui.row}>
              <Icon name={icon} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={ui.rowTitle}>{title}</Text>
                <Text style={ui.small}>{sendProgress[key]}</Text>
              </View>
              {key === "request" && <ActivityIndicator color={colors.forest} />}
            </View>
          ))}
          <Note>
            Please don’t submit the same issue again while we’re checking the
            county response.
          </Note>
          <CountyPortal
            report={r}
            automatic
            onProgress={(step, message) =>
              setSendProgress((current) => ({ ...current, [step]: message }))
            }
            onSubmitted={submissionCompleted}
            onFailure={submissionFailed}
            onUncertain={submissionUncertain}
          />
        </>
      )}
      {phase === "uncertain" && (
        <>
          <View style={{ alignItems: "center", paddingTop: 36, gap: 24 }}>
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 36,
                backgroundColor: colors.peach,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="clock" size={54} />
            </View>
            <Title sub="Your report may already have arrived. We kept its copy on this device.">
              We need to check.
            </Title>
          </View>
          <Note warning>
            {submissionIssue || "MC311 did not return a readable confirmation."}{" "}
            Check the email address used for this report, including spam, before
            trying to submit again.
          </Note>
          <Row
            title="Add a request number"
            subtitle="Use the number from your county confirmation email"
            icon="list"
            onPress={() => go("receipt")}
          />
          <Button
            label="Check MC311 status"
            onPress={() => task(() => Linking.openURL(COUNTY_STATUS_URL))}
          />
          <TextLink
            label="Contact MC311 · 240-777-0311"
            onPress={() => task(() => Linking.openURL("tel:2407770311"))}
          />
          <TextLink
            label="Keep my copy without retrying"
            onPress={() => go("detail")}
          />
        </>
      )}
      {phase === "success" && (
        <>
          <View style={{ alignItems: "center", paddingTop: 44, gap: 24 }}>
            <View
              style={{
                width: 112,
                height: 112,
                borderRadius: 36,
                backgroundColor: colors.mint,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={58} />
            </View>
            <Title sub="Your report is with MC311. You can check back here for its receipt.">
              You did your part.
            </Title>
          </View>
          <View style={ui.card}>
            <Text style={sharedStyles.eyebrow}>SERVICE REQUEST NUMBER</Text>
            <Text selectable style={sharedStyles.heading}>
              {r.receipt}
            </Text>
            <Text style={ui.rowTitle}>
              {r.photoStatus === "attached"
                ? "Report and photo received"
                : r.photo
                  ? "Report received · photo needs follow-up"
                  : "Report received"}
            </Text>
            {r.contact?.email ? (
              <Text style={ui.small}>Confirmation: {r.contact.email}</Text>
            ) : null}
          </View>
          <Note>
            The county reviews and schedules work. A receipt does not mean a
            repair is complete.
          </Note>
          <Button label="View my report" onPress={() => go("detail")} />
          <TextLink
            label="Back to home"
            onPress={() => router.replace("/home")}
          />
        </>
      )}
      {phase === "handoff" && (
        <>
          <Title sub="Your report is saved here. Finish on the official website.">
            Finish with the county.
          </Title>
          <Note warning>
            Check for a confirmation email before submitting again. Opening the
            site or filling fields is not proof that a request was created.
          </Note>
          <View style={ui.actions}>
            {Platform.OS !== "web" && !r.receipt && !automationError(r) && (
              <Button
                label="Review and try automatic submission again"
                onPress={() => go("confirm")}
              />
            )}
            <Button
              label="Copy report summary"
              onPress={() =>
                task(async () => {
                  await Clipboard.setStringAsync(summary(r));
                  setNotice(
                    "Summary copied. Contact details are not included.",
                  );
                })
              }
            />
            <Button
              label="Open MC311 in browser"
              light
              onPress={() =>
                task(async () => {
                  await Linking.openURL(destination(r));
                })
              }
            />
            <Button
              label="Check MC311 request status"
              light
              onPress={() => task(() => Linking.openURL(COUNTY_STATUS_URL))}
            />
            {Platform.OS !== "web" && !r.receipt && (
              <Button
                label={
                  portal
                    ? "Close embedded county site"
                    : "Open county site in app"
                }
                light
                onPress={() => setPortal(!portal)}
              />
            )}
          </View>
          {portal && <CountyPortal report={r} />}
          {Platform.OS === "web" && <CountyPortal report={r} />}
          {r.photo && (
            <Button
              label="Share or save photo for county upload"
              light
              onPress={() =>
                task(async () => {
                  if (Platform.OS === "web")
                    throw new Error(
                      "Use your original photo when the county asks for an attachment.",
                    );
                  if (!(await Sharing.isAvailableAsync()))
                    throw new Error(
                      "Photo sharing is not available on this device. Use your original photo.",
                    );
                  await Sharing.shareAsync(r.photo!, {
                    mimeType: "image/jpeg",
                    dialogTitle: "Save or share issue photo",
                  });
                })
              }
            />
          )}
          <Note>
            After the county accepts your request, complete its photo upload
            step. If attachment fails, follow up using the existing request
            number—do not create another request.
          </Note>
          <Button
            label="I have a county request number"
            onPress={() => go("receipt")}
          />
          <TextLink
            label="No confirmation yet · keep my copy"
            onPress={() => go("detail")}
          />
          <TextLink
            label="Call MC311 · 240-777-0311"
            onPress={() => task(() => Linking.openURL("tel:2407770311"))}
          />
        </>
      )}
      {phase === "receipt" && (
        <>
          <Title sub="Find it in your county confirmation email.">
            Have a request number?
          </Title>
          <Field
            label="County request number"
            value={receipt}
            maxLength={80}
            autoCapitalize="characters"
            onChangeText={setReceipt}
          />
          <Note>
            We’ll label this number as entered by you. County status and photo
            attachment have not been verified.
          </Note>
          <Button
            label="Save request number"
            disabled={locked}
            onPress={() =>
              task(async () => {
                await store.put(saveReceipt(latest.current, receipt));
                go("detail");
              })
            }
          />
          <TextLink
            label="I don’t have a receipt yet"
            onPress={() => go("detail")}
          />
        </>
      )}
      {phase === "detail" && (
        <>
          <Title sub={addressText(r.location)}>
            {categoryName(r.category)}
          </Title>
          <Badge label={statusLabel(r)} />
          {r.receipt && (
            <View style={[ui.card, { marginTop: 18 }]}>
              <Text style={sharedStyles.eyebrow}>
                {r.receiptSource === "county"
                  ? "MC311 SERVICE REQUEST NUMBER"
                  : "COUNTY REQUEST NUMBER · ENTERED BY YOU"}
              </Text>
              <Text selectable style={sharedStyles.heading}>
                {r.receipt}
              </Text>
            </View>
          )}
          {r.receiptSource === "county" ? (
            <Note>
              {r.photoStatus === "attached"
                ? "MC311 returned this receipt and the county page confirmed the photo attachment."
                : r.photo
                  ? "MC311 returned this receipt. The photo attachment was not confirmed; follow up with this request number."
                  : "MC311 returned this receipt. County work status is not synchronized yet."}
            </Note>
          ) : (
            <Note warning>
              {r.receipt
                ? "Receipt saved, not verified. County status and photo attachment are unknown."
                : "Submission is not confirmed. Check your county email or call MC311 before creating another request."}
            </Note>
          )}
          <Text style={[sharedStyles.eyebrow, { marginVertical: 20 }]}>
            REPORT TIMELINE
          </Text>
          {r.timeline.map((event, index) => (
            <View
              key={`${event.at}-${index}`}
              style={[ui.card, { flexDirection: "row" }]}
            >
              <Icon name="clock" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={ui.rowTitle}>{event.text}</Text>
                <Text style={ui.small}>
                  {new Date(event.at).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
          <Button label="View report summary" onPress={() => go("summary")} />
          <View style={ui.actions}>
            {Platform.OS !== "web" &&
              r.status === "handoff" &&
              !r.receipt &&
              !automationError(r) && (
                <Button
                  label="Review and retry automatic submission"
                  onPress={() => go("confirm")}
                />
              )}
            <Button
              label={
                r.receipt
                  ? "Correct saved request number"
                  : "Add a county request number"
              }
              light
              onPress={() => go("receipt")}
            />
            <Button
              label="County website and follow-up"
              light
              onPress={() => go("handoff")}
            />
            <TextLink
              label={
                r.archived ? "Move out of archive" : "Archive this local record"
              }
              onPress={() =>
                task(async () => {
                  await patch({ archived: !r.archived });
                  router.replace("/reports");
                })
              }
            />
            <TextLink
              label="Back to my reports"
              onPress={() => router.replace("/reports")}
            />
          </View>
        </>
      )}
      {phase === "summary" && (
        <>
          <Title>What you reported.</Title>
          {details}
          <Note>
            This is your saved submission copy. County status is not
            synchronized; changes to a county request must be made through
            MC311.
          </Note>
          <Button
            label="Share report summary"
            onPress={() =>
              task(async () => {
                await Share.share({ message: summary(r) });
              })
            }
          />
          <TextLink label="Back to timeline" onPress={() => go("detail")} />
        </>
      )}
      {phase === "saved" && (
        <>
          <Title sub="Nothing will be submitted automatically.">
            Saved. Send it later.
          </Title>
          <View style={{ alignItems: "center", padding: 40 }}>
            <Icon name="check" size={68} />
          </View>
          <Note>
            Your photo, description and location are saved on this device. Open
            the draft in My reports when you’re ready.
          </Note>
          <Button
            label="Back to my reports"
            onPress={() => router.replace("/reports")}
          />
          <TextLink label="Continue editing" onPress={() => go("capture")} />
        </>
      )}
      {phase === "urgent" && (
        <>
          <Title>Could someone be in immediate danger?</Title>
          <Note warning>
            Stay clear of hazards. For immediate danger, call 911. Ordinary
            MC311 reports may not be reviewed right away. This app cannot assess
            whether a scene is safe.
          </Note>
          <Button
            label="Call 911"
            onPress={() => task(() => Linking.openURL("tel:911"))}
          />
          <TextLink
            label="No immediate danger · continue report"
            onPress={() => go("capture")}
          />
        </>
      )}
      {phase === "jurisdiction" && (
        <>
          <Title>Let’s find the right team.</Title>
          <Note>
            You indicated this may belong to another authority. We have not
            verified road ownership. Your report is preserved; MC311 can help
            identify where it belongs.
          </Note>
          <Button
            label="Open official MC311 options"
            onPress={() => task(() => Linking.openURL(COUNTY_URL))}
          />
          <TextLink
            label="Change location or responsibility"
            onPress={() => go("location")}
          />
          <TextLink
            label="Continue with MC311 review"
            onPress={() => go("categories")}
          />
        </>
      )}
    </Screen>
  );
}
