import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import type { Report } from "../domain";
import {
  automationError,
  countyNavigationAllowed,
  destination,
  fillScript,
  submissionScript,
} from "../county";
import { photoData } from "../media";
import { Button } from "./Controls";
import { ErrorNote, Note } from "./UI";

export type CountyProgress = "request" | "photo" | "receipt";
export type CountySubmission = {
  receipt: string;
  photoStatus: "none" | "pending" | "attached";
};

type Props = {
  report: Report;
  automatic?: boolean;
  onProgress?: (step: CountyProgress, message: string) => void;
  onSubmitted?: (result: CountySubmission) => void;
  onFailure?: (message: string) => void;
  onUncertain?: (message: string) => void;
};

export function CountyPortal({
  report,
  automatic = false,
  onProgress,
  onSubmitted,
  onFailure,
  onUncertain,
}: Props) {
  const web = useRef<WebView>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [mediaReady, setMediaReady] = useState(!report.photo);
  const completed = useRef(false);
  const submissionStarted = useRef(false);
  const token = useRef(
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
  ).current;
  const invalid = automationError(report);

  useEffect(() => {
    if (!automatic || !report.photo) return;
    let active = true;
    void photoData(report.photo)
      .then((value) => {
        if (active) setPhoto(value);
      })
      .catch(() => {
        if (active) setPhoto(undefined);
      })
      .finally(() => {
        if (active) setMediaReady(true);
      });
    return () => {
      active = false;
    };
  }, [automatic, report.photo]);

  useEffect(() => {
    if (!automatic) return;
    if (invalid) {
      onFailure?.(invalid);
      return;
    }
    const timer = setTimeout(() => {
      if (!completed.current) {
        completed.current = true;
        onUncertain?.(
          "MC311 did not return a receipt in time. Check your confirmation email before retrying.",
        );
      }
    }, 90000);
    return () => clearTimeout(timer);
  }, [automatic, invalid, onUncertain]);

  const inject = () => {
    if (!mediaReady || invalid) return;
    try {
      web.current?.injectJavaScript(
        automatic ? submissionScript(report, token, photo) : fillScript(report),
      );
    } catch (e) {
      const value = (e as Error).message;
      setError(value);
      completed.current = true;
      onFailure?.(value);
    }
  };

  if (automatic && invalid) {
    return null;
  }

  return (
    <View style={{ gap: 12 }}>
      {!automatic && (
        <>
          <Note>
            Official MC311 website below. You can fill the reviewed fields,
            inspect every value, and submit on the county page.
          </Note>
          <Button label="Fill reviewed fields" onPress={inject} />
          {message ? <Note>{message}</Note> : null}
          <ErrorNote message={error} />
        </>
      )}
      <View
        accessibilityElementsHidden={automatic}
        importantForAccessibility={automatic ? "no-hide-descendants" : "auto"}
        style={
          automatic
            ? { height: 2, opacity: 0.01, overflow: "hidden" }
            : { height: 580, borderRadius: 16, overflow: "hidden" }
        }
      >
        {mediaReady && (
          <WebView
            ref={web}
            source={{ uri: destination(report) }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState={!automatic}
            incognito
            setSupportMultipleWindows={false}
            mixedContentMode="never"
            allowFileAccess={false}
            onShouldStartLoadWithRequest={(request) =>
              countyNavigationAllowed(request.url)
            }
            onLoadEnd={inject}
            onMessage={(event) => {
              try {
                if (completed.current) return;
                const data = JSON.parse(event.nativeEvent.data);
                if (data.source !== "moco-automation") return;
                if (automatic && data.token !== token) return;
                if (data.type === "ready" && typeof data.message === "string")
                  setMessage(data.message.slice(0, 500));
                if (
                  data.type === "progress" &&
                  ["request", "photo", "receipt"].includes(data.step) &&
                  typeof data.message === "string"
                ) {
                  if (data.step === "receipt") submissionStarted.current = true;
                  onProgress?.(data.step, data.message.slice(0, 200));
                }
                if (
                  data.type === "submitted" &&
                  /^\d{8,12}$/.test(data.receipt) &&
                  ["none", "pending", "attached"].includes(data.photoStatus)
                ) {
                  completed.current = true;
                  onSubmitted?.({
                    receipt: data.receipt,
                    photoStatus: data.photoStatus,
                  });
                }
                if (data.type === "error" && typeof data.message === "string") {
                  completed.current = true;
                  const value = data.message.slice(0, 500);
                  setError(value);
                  onFailure?.(value);
                }
                if (
                  data.type === "uncertain" &&
                  typeof data.message === "string"
                ) {
                  completed.current = true;
                  const value = data.message.slice(0, 500);
                  setError(value);
                  onUncertain?.(value);
                }
              } catch {}
            }}
            onError={() => {
              if (completed.current) return;
              completed.current = true;
              const value =
                "The county page could not load. Check your connection and confirmation email before retrying.";
              setError(value);
              if (submissionStarted.current) onUncertain?.(value);
              else onFailure?.(value);
            }}
            onHttpError={() => {
              if (completed.current) return;
              completed.current = true;
              const value =
                "The county site returned an error. Check your confirmation email before retrying.";
              setError(value);
              if (submissionStarted.current) onUncertain?.(value);
              else onFailure?.(value);
            }}
          />
        )}
      </View>
    </View>
  );
}
