import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts as useInterFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts as usePlayfairFonts, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import FondoAnimado from '@/components/FondoAnimado';
import { AuthProvider } from '@/context/AuthContext';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    card: 'transparent',
  },
};

export default function RootLayout() {
  const [playfairLoaded, playfairError] = usePlayfairFonts({ PlayfairDisplay_700Bold });
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if ((!playfairLoaded || !interLoaded) && !playfairError && !interError) {
    return (
      <View
        style={{
          flex: 1,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#0f172a',
        }}
      />
    );
  }

  return (
    <FondoAnimado>
      <StatusBar style="light" />
      <ThemeProvider value={navigationTheme}>
        <AuthProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </FondoAnimado>
  );
}
