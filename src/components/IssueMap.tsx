import MapView, { Marker } from "react-native-maps";
import { View } from "react-native";
import type { IssueLocation } from "../domain";
import { Note } from "./UI";
export function IssueMap({
  location,
  onPin,
}: {
  location: IssueLocation;
  onPin: (lat: number, lng: number) => void;
}) {
  if (location.latitude == null || location.longitude == null)
    return (
      <Note>
        Use your current location or enter a street or intersection below. No
        location is collected in the background.
      </Note>
    );
  const coordinate = {
    latitude: location.latitude,
    longitude: location.longitude,
  };
  return (
    <View
      style={{
        height: 260,
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <MapView
        accessibilityLabel="Issue location map. Drag the pin or tap to adjust."
        style={{ flex: 1 }}
        region={{ ...coordinate, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        onPress={(e) =>
          onPin(
            e.nativeEvent.coordinate.latitude,
            e.nativeEvent.coordinate.longitude,
          )
        }
      >
        <Marker
          coordinate={coordinate}
          draggable
          onDragEnd={(e) =>
            onPin(
              e.nativeEvent.coordinate.latitude,
              e.nativeEvent.coordinate.longitude,
            )
          }
        />
      </MapView>
    </View>
  );
}
