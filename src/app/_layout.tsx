import { Stack } from 'expo-router';
import { useFonts as useInterFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts as usePlayfairFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { View } from 'react-native';

import { AuthProvider } from '@/context/AuthContext';
import { colors } from '@/theme';

export default function RootLayout() {
  const [playfairLoaded, playfairError] = usePlayfairFonts({ PlayfairDisplay_700Bold });
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if ((!playfairLoaded || !interLoaded) && !playfairError && !interError) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
