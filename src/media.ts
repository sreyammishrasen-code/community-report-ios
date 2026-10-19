import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";

const mediaDirectory = () => `${FileSystem.documentDirectory}moco-media/`;
export async function keepPhoto(uri: string, id: string) {
  // Re-encode to cap size and avoid retaining the original photo's EXIF metadata.
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  if (!result.base64 || result.base64.length > 4_000_000)
    throw new Error("This photo is too large. Choose a smaller image.");
  if (Platform.OS === "web") return `data:image/jpeg;base64,${result.base64}`;
  await FileSystem.makeDirectoryAsync(mediaDirectory(), {
    intermediates: true,
  });
  const dest = `${mediaDirectory()}${id}-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: result.uri, to: dest });
  return dest;
}
export async function photoData(uri?: string) {
  if (!uri) return undefined;
  if (uri.startsWith("data:image/jpeg;base64,")) return uri;
  return `data:image/jpeg;base64,${await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })}`;
}
export async function removePhoto(uri?: string) {
  if (Platform.OS !== "web" && uri?.startsWith(mediaDirectory()))
    await FileSystem.deleteAsync(uri, { idempotent: true });
}
export async function clearMedia() {
  if (Platform.OS !== "web") {
    await FileSystem.deleteAsync(mediaDirectory(), { idempotent: true });
    await clearTemporaryMedia();
  }
}
// Expo SDK 57 uses these directories inside this app's scoped cache. Never clear the whole cache root.
export async function clearTemporaryMedia() {
  if (Platform.OS === "web" || !FileSystem.cacheDirectory) return;
  for (const directory of [
    "Audio",
    "ExpoAudio",
    "ImagePicker",
    "ImageManipulator",
  ]) {
    await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${directory}/`, {
      idempotent: true,
    });
  }
}
export async function discardAudio(uri?: string | null) {
  if (Platform.OS === "web" && uri?.startsWith("blob:"))
    URL.revokeObjectURL(uri);
  if (
    Platform.OS !== "web" &&
    uri?.startsWith(FileSystem.cacheDirectory ?? "file:///__none__/")
  )
    await FileSystem.deleteAsync(uri, { idempotent: true });
}
