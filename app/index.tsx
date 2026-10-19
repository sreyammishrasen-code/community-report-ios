import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, sharedStyles } from '../src/components/Controls';
import { NeighborhoodArt } from '../src/components/NeighborhoodArt';
import { Screen } from '../src/components/Screen';
import { colors } from '../src/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const openHome = () => router.push('/home');

  return (
    <Screen>
      <View style={styles.brandRow}>
        <Text style={styles.wordmark} accessibilityLabel="MoCo Report">m.</Text>
        <Badge label="MoCo Report" />
      </View>
      <NeighborhoodArt />
      <View style={styles.message}>
        <Text accessibilityRole="header" style={styles.headline}>Small action.{ '\n' }Better block.</Text>
        <Text style={[sharedStyles.body, styles.intro]}>Spot a problem in your neighborhood?{ '\n' }Take a photo. Say a few words.{ '\n' }We’ll help prepare your MC311 report.</Text>
      </View>
      <View style={styles.bottom}>
        <Badge label="PHOTO + VOICE + LOCATION" style={styles.tag} />
        <Button label="Get started" onPress={openHome} testID="get-started" />
        <Pressable onPress={openHome} accessibilityRole="button" testID="explore-first"
          style={({ pressed }) => [sharedStyles.link, styles.explore, pressed && sharedStyles.pressed]}>
          <Text style={sharedStyles.linkText}>Explore first</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 27, minHeight: 47 },
  wordmark: { fontSize: 39, fontWeight: '700', letterSpacing: -2, color: colors.forest },
  message: { paddingTop: 36 },
  headline: { color: colors.forest, fontSize: 40, fontWeight: '600', letterSpacing: -1.4, lineHeight: 46 },
  intro: { marginTop: 20, fontSize: 16, lineHeight: 26 },
  bottom: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 34 },
  tag: { marginBottom: 30 },
  explore: { marginTop: 8 },
});
