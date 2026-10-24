# FixMoco

First implementation pass: Welcome (`/`) and Home (`/home`), using the approved `mc311-design` proposal. Built with Expo SDK 57, React Native, TypeScript and Expo Router. Use an SDK 57-compatible Expo Go client. Native iOS builds require Xcode 26.4 or newer and target iOS 16.4 or newer; see the [Expo release notes](https://expo.dev/changelog/sdk-56).

## Run

```sh
cd community-report
npm ci
npm start
```

Use `npm run ios` with Xcode and an iOS simulator, or `npm run web` for a browser preview. Both welcome buttons navigate to Home. Home’s back button returns to Welcome. Onboarding is not persisted in this pass so the first screen remains easy to preview.

Home uses visibly labeled sample draft/activity data. Report and sample-card actions display an inline message for the next implementation pass. My reports and You tabs are marked Soon and disabled. Only two screens exist; no API calls, county automation, device permissions, accounts or report submission are wired in yet.

The neighborhood illustration is an original vector component and does not request GPS or external map tiles. Screens use native safe areas, system fonts, scalable text, scrollable content, accessible labels and a bounded width on desktop. System status bars are supplied by the device.

## Check / build

```sh
npm run typecheck
npx expo install --check
npx expo-doctor@latest
npm run export:web
npm run export:ios -- --output-dir dist-ios
```

## Optional AI service configuration

The AI backend is configured by the app build. Users do not enter a URL or token in the app.
The production API URL defaults to `https://community-report-api.onrender.com` and can be
overridden with `EXPO_PUBLIC_API_URL`.

For local development, copy `.env.example` to a gitignored `.env.local` and set
`EXPO_PUBLIC_FIXMOCO_CLIENT_TOKEN` to the same value as the deployed backend's
`APP_ACCESS_TOKEN`.

For an EAS production build, add the client values to the production environment:

```sh
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://community-report-api.onrender.com --environment production --visibility plaintext
npx eas-cli@latest env:set --name EXPO_PUBLIC_FIXMOCO_CLIENT_TOKEN --environment production --visibility sensitive
```

EAS prompts for the second value. `eas.json` maps production builds to the production
environment. Values prefixed with `EXPO_PUBLIC_` are bundled into the app and must not contain
an OpenAI key or any true server secret. Keep `OPENAI_API_KEY` only on Render. The shared client
credential is a basic abuse-control layer; the backend's IP rate limits remain required.

Exports validate bundling; an iOS export is not a signed IPA or an App Store build. Store identifiers, icons and signing will be configured in a later release pass.

SDK 57 upgrade checks: TypeScript, Expo dependency compatibility, all 21 Expo Doctor checks, and web/iOS/Android bundle exports pass. Native builds and simulator/device runtime behavior have not been verified as part of this upgrade.

Dependency baseline after the upgrade: npm reports 13 moderate vulnerabilities. No forced major-version overrides were applied. Dependency versions follow Expo's SDK 57 compatibility recommendations; see the [SDK 57 release notes](https://expo.dev/changelog/sdk-57).
