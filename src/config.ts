const DEFAULT_API_URL = "https://community-report-api.onrender.com";

export type Connection = { url: string; token: string };

// EXPO_PUBLIC values are bundled into the client. This token is an app-client
// credential, not an OpenAI key or a substitute for server-side rate limits.
export const backendConnection: Connection = Object.freeze({
  url: (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL)
    .trim()
    .replace(/\/$/, ""),
  token: (process.env.EXPO_PUBLIC_FIXMOCO_CLIENT_TOKEN || "").trim(),
});

export const aiServiceConfigured =
  !!backendConnection.url && backendConnection.token.length >= 24;
