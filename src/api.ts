import { Platform } from "react-native";
import { File } from "expo-file-system";
import { analysisSchema, type Report } from "./domain";
import { photoData } from "./media";
import type { Connection } from "./config";

export function connectionError(c: Connection) {
  try {
    const url = new URL(c.url);
    const local =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(
        url.hostname,
      );
    if (
      url.protocol !== "https:" &&
      !(__DEV__ && local && url.protocol === "http:")
    )
      return "Use HTTPS (local HTTP is allowed only in development).";
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    )
      return "Use a server origin only, without a path, credentials or query.";
    if (c.token.trim().length < 24)
      return "FixMoco’s optional AI service is not available in this build. You can continue without AI.";
    return null;
  } catch {
    return "FixMoco’s optional AI service is not configured correctly. You can continue without AI.";
  }
}
async function request(c: Connection, path: string, body?: BodyInit) {
  const invalid = connectionError(c);
  if (invalid) throw new Error(invalid);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${c.url.replace(/\/$/, "")}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${c.token}`,
        ...(typeof body === "string"
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error ||
          "The service is unavailable. Your draft is still on this device.",
      );
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError")
      throw new Error(
        "The AI service timed out. Nothing was sent to MC311. Try again or choose a category manually.",
      );
    if (
      error instanceof Error &&
      /fetch|network|connect/i.test(error.message)
    ) {
      const hostname = new URL(c.url).hostname;
      if (
        Platform.OS !== "web" &&
        (hostname === "localhost" || hostname === "127.0.0.1")
      )
        throw new Error(
          "This phone cannot use localhost to reach your computer. Use the computer’s Wi-Fi address, for example http://192.168.0.103:3001.",
        );
      throw new Error(
        "Could not reach FixMoco’s optional AI service. Check your internet connection and try again, or continue without AI.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
export async function analyze(c: Connection, r: Report) {
  // Contact information and GPS are deliberately not sent to the AI endpoint.
  return analysisSchema.parse(
    await request(
      c,
      "/analyze",
      JSON.stringify({
        description: r.description,
        photo: await photoData(r.photo),
        consent: true,
      }),
    ),
  );
}
export async function transcribe(c: Connection, uri: string) {
  const form = new FormData();
  if (Platform.OS === "web")
    form.append("audio", await (await fetch(uri)).blob(), "recording.webm");
  else form.append("audio", new File(uri));
  form.append("consent", "true");
  const result = await request(c, "/transcribe", form);
  if (typeof result.text !== "string" || !result.text.trim())
    throw new Error(
      "No speech was recognized. Try again or type your description.",
    );
  return result.text.slice(0, 2000);
}
