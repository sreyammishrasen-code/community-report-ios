import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  Platform,
  Text,
  View,
  ActivityIndicator,
  Pressable,
} from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  contactSchema,
  initialState,
  newReport,
  reportSchema,
  stateSchema,
  type Contact,
  type Report,
  type SavedState,
} from "./domain";
import { clearMedia, clearTemporaryMedia, removePhoto } from "./media";
import { colors } from "./theme";
import { PersistenceQueue } from "./persistence";
import { backendConnection, type Connection } from "./config";

const DATA_KEY = "moco.state.v1";
const PROFILE_KEY = "moco.profile.v1";
const CONNECTION_KEY = "moco.connection.v1";
async function secretGet(key: string) {
  return Platform.OS === "web"
    ? AsyncStorage.getItem(key)
    : SecureStore.getItemAsync(key);
}
async function secretSet(key: string, value: string | null) {
  if (Platform.OS === "web")
    return value === null
      ? AsyncStorage.removeItem(key)
      : AsyncStorage.setItem(key, value);
  return value === null
    ? SecureStore.deleteItemAsync(key)
    : SecureStore.setItemAsync(key, value);
}
type Store = {
  state: SavedState;
  profile?: Contact;
  connection: Connection;
  storageError: string | null;
  create: () => Promise<Report>;
  put: (r: Report) => Promise<void>;
  deleteDraft: (id: string) => Promise<void>;
  saveProfile: (c?: Contact) => Promise<void>;
  preferences: (p: Partial<SavedState["preferences"]>) => Promise<void>;
  clear: () => Promise<void>;
  flush: () => Promise<void>;
};
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<SavedState>(initialState);
  const current = useRef(state);
  const [profile, setProfile] = useState<Contact>();
  const [ready, setReady] = useState(false);
  const [storageError, setError] = useState<string | null>(null);
  const loadFailed = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const queue = useRef<PersistenceQueue | null>(null);
  if (!queue.current)
    queue.current = new PersistenceQueue((failed) => {
      if (!loadFailed.current)
        setError(
          failed
            ? "Your latest changes could not be saved. Keep the app open, free device storage, then retry saving."
            : null,
        );
    });
  useEffect(() => {
    void (async () => {
      try {
        await clearTemporaryMedia();
        const [data, contact] = await Promise.all([
          AsyncStorage.getItem(DATA_KEY),
          secretGet(PROFILE_KEY),
          // Remove credentials saved by older builds. Backend configuration is
          // now supplied by the app build and is not user-editable.
          secretSet(CONNECTION_KEY, null),
        ]);
        if (data) {
          const saved = stateSchema.parse(JSON.parse(data));
          current.current = saved;
          setState(saved);
        }
        if (contact) setProfile(contactSchema.parse(JSON.parse(contact)));
      } catch {
        loadFailed.current = true;
        setError(
          "Saved data could not be loaded. Existing storage has not been overwritten. Restart the app, or explicitly delete app data in You.",
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);
  const enqueue = (key: string, task: () => Promise<void>) =>
    loadFailed.current
      ? Promise.reject(
          new Error("Saved data could not be loaded. Restart before editing."),
        )
      : queue.current!.write(key, task);
  const commit = (next: SavedState) => {
    if (loadFailed.current)
      return Promise.reject(
        new Error(storageError ?? "Storage is unavailable."),
      );
    current.current = next;
    setState(next);
    return enqueue(DATA_KEY, () =>
      AsyncStorage.setItem(DATA_KEY, JSON.stringify(next)),
    );
  };
  const put = (report: Report) => {
    const parsed = reportSchema.safeParse(report);
    if (!parsed.success)
      return Promise.reject(
        new Error(
          "This report contains invalid or oversized data. Please review the fields.",
        ),
      );
    const reports = current.current.reports;
    const exists = reports.some((r) => r.id === report.id);
    if (!exists)
      return Promise.reject(
        new Error("This report no longer exists on this device."),
      );
    return commit({
      ...current.current,
      reports: reports.map((r) => (r.id === report.id ? report : r)),
    });
  };
  const value: Store = {
    state,
    profile,
    connection: backendConnection,
    storageError,
    put,
    deleteDraft: async (id) => {
      const report = current.current.reports.find((item) => item.id === id);
      if (!report)
        throw new Error("This draft no longer exists on this device.");
      if (report.status !== "draft")
        throw new Error(
          "Only drafts can be deleted. Submitted reports can be archived instead.",
        );
      await commit({
        ...current.current,
        reports: current.current.reports.filter((item) => item.id !== id),
      });
      await removePhoto(report.photo).catch(() => {});
    },
    create: async () => {
      if (current.current.reports.length >= 200)
        throw new Error(
          "This device has reached the 200-report limit. Export records before clearing app data.",
        );
      const r = newReport(
        `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      );
      await commit({
        ...current.current,
        reports: [r, ...current.current.reports],
      });
      return r;
    },
    saveProfile: async (c) => {
      await enqueue(PROFILE_KEY, async () => {
        await secretSet(PROFILE_KEY, c ? JSON.stringify(c) : null);
        setProfile(c);
      });
    },
    preferences: (p) =>
      commit({
        ...current.current,
        preferences: { ...current.current.preferences, ...p },
      }),
    flush: () =>
      loadFailed.current
        ? Promise.reject(new Error(storageError ?? "Storage is unavailable."))
        : queue.current!.flush(),
    clear: async () => {
      await queue.current!.settled();
      await clearMedia();
      await Promise.all([
        AsyncStorage.removeItem(DATA_KEY),
        secretSet(PROFILE_KEY, null),
        secretSet(CONNECTION_KEY, null),
      ]);
      current.current = initialState;
      setState(initialState);
      setProfile(undefined);
      loadFailed.current = false;
      queue.current!.reset();
      setError(null);
    },
  };
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: colors.paper,
        }}
      >
        <ActivityIndicator
          color={colors.forest}
          accessibilityLabel="Loading saved reports"
        />
      </View>
    );
  return (
    <Context.Provider value={value}>
      {storageError && (
        <Text
          accessibilityRole="alert"
          style={{
            padding: 16,
            backgroundColor: "#F5E8D1",
            color: colors.forest,
          }}
        >
          {storageError}
        </Text>
      )}
      {storageError && !loadFailed.current && (
        <Pressable
          accessibilityRole="button"
          disabled={retrying}
          accessibilityState={{ disabled: retrying }}
          onPress={() => {
            setRetrying(true);
            void queue
              .current!.retry()
              .catch(() => {})
              .finally(() => setRetrying(false));
          }}
          style={{ padding: 16, backgroundColor: "#F5E8D1" }}
        >
          <Text style={{ color: colors.forest, fontWeight: "700" }}>
            {retrying ? "Retrying…" : "Retry saving"}
          </Text>
        </Pressable>
      )}
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("StoreProvider missing");
  return store;
}
