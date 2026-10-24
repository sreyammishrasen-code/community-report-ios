import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Text, View } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Button } from "./Controls";
import { ErrorNote, Note, TextLink, ui } from "./UI";
import { transcribe } from "../api";
import { discardAudio } from "../media";
import type { Connection } from "../config";

function recordingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /prepareToRecordAsync|AudioRecordingException|Failed to configure audio session|Session activation failed/i.test(
      message,
    )
  )
    return "The microphone is busy with a call, Siri, screen recording, or another app. End or dismiss it, then tap Record a description again.";
  return message;
}

export function VoiceCapture({
  connection,
  enabled,
  onText,
  onBusy,
}: {
  connection: Connection;
  enabled: boolean;
  onText: (text: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [audio, setAudio] = useState<string>();
  const mounted = useRef(true);
  const uriRef = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const converting = useRef(false);
  const cleanup = async () => {
    await discardAudio(uriRef.current);
    uriRef.current = undefined;
    if (mounted.current) setAudio(undefined);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onBusy(false);
      void (async () => {
        if (recorder.isRecording) await recorder.stop();
        await discardAudio(recorder.uri);
        await discardAudio(uriRef.current);
        await setAudioModeAsync({ allowsRecording: false });
      })().catch(() => {});
    };
  }, [recorder]);
  const convert = async (uri: string) => {
    if (!mounted.current || converting.current) return;
    converting.current = true;
    setPending(true);
    onBusy(true);
    setError("");
    try {
      const text = await transcribe(connection, uri);
      if (mounted.current) {
        onText(text);
        await cleanup();
      }
    } catch (e) {
      if (mounted.current)
        setError(
          `${(e as Error).message} Recording stays only while this screen is open. Retry, or type instead before leaving.`,
        );
    } finally {
      converting.current = false;
      if (mounted.current) {
        setPending(false);
        onBusy(false);
      }
    }
  };
  const stop = async () => {
    if (lock.current) return;
    lock.current = true;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;
      if (!mounted.current) {
        await discardAudio(uri);
        return;
      }
      if (!uri)
        throw new Error(
          "No recording was captured. Try again or type your description.",
        );
      uriRef.current = uri;
      setAudio(uri);
      await convert(uri);
    } catch (e) {
      if (mounted.current) {
        setError(recordingError(e));
        onBusy(false);
      }
    } finally {
      lock.current = false;
    }
  };
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= 60000) void stop();
  }, [state.durationMillis]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (s) => {
      if (s !== "active" && recorder.isRecording) void stop();
    });
    return () => subscription.remove();
  }, [recorder]);
  const start = async () => {
    if (lock.current || converting.current) return;
    lock.current = true;
    setError("");
    onBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!mounted.current) return;
      if (!permission.granted)
        throw new Error(
          "Microphone access is off. You can type instead or enable it in device settings.",
        );
      await cleanup();
      if (!mounted.current) return;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: "mixWithOthers",
      });
      if (!mounted.current) {
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      await recorder.prepareToRecordAsync();
      if (!mounted.current) {
        await recorder.stop();
        await discardAudio(recorder.uri);
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      recorder.record();
      onBusy(true);
    } catch (e) {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (mounted.current) {
        setError(recordingError(e));
        onBusy(false);
      }
    } finally {
      lock.current = false;
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <Button
        label={
          pending
            ? "Transcribing…"
            : state.isRecording
              ? `Stop recording · ${Math.floor(state.durationMillis / 1000)}s`
              : "Record a description"
        }
        onPress={state.isRecording ? stop : start}
        disabled={pending || (!state.isRecording && !enabled)}
        light
      />
      {state.isRecording && (
        <Note>
          Recording · maximum 60 seconds. Your editable transcript appears after
          you stop.
        </Note>
      )}
      {!enabled && (
        <Text style={ui.small}>
          Voice transcription is available when optional AI is enabled and the
          service is online. Text reporting always works without AI.
        </Text>
      )}
      <ErrorNote message={error} />
      {audio && !pending && (
        <>
          <Button
            label="Retry transcription"
            onPress={() => convert(audio)}
            disabled={!enabled}
          />
          <TextLink
            label="Discard recording"
            onPress={() => {
              void cleanup().catch((e) => setError(e.message));
            }}
          />
        </>
      )}
      {error.includes("access") && (
        <TextLink
          label="Open device settings"
          onPress={() => {
            void Linking.openSettings().catch(() =>
              setError("Open your device settings manually."),
            );
          }}
        />
      )}
    </View>
  );
}
