import { router } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cardElevation, colors, fonts } from '@/theme';

const privacyPolicyUrl = 'https://vanitas990.github.io/asistencia-ix-web/';

export default function PrivacyPolicyScreen() {
  const handleOpenPrivacy = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(privacyPolicyUrl);
      if (supported) {
        await Linking.openURL(privacyPolicyUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir el enlace en este dispositivo.');
      }
    } catch (error) {
      console.error('No se pudo abrir la política de privacidad.', error);
      Alert.alert('Error', 'No se puede abrir el enlace en este dispositivo.');
    }
  }, []);

  useEffect(() => {
    void handleOpenPrivacy();
  }, [handleOpenPrivacy]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹  Volver</Text>
        </Pressable>
        <Text style={styles.headerLabel}>ASISTENCIA IX</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>INFORMACIÓN LEGAL</Text>
          <Text style={styles.title}>Política y Privacidad</Text>
          <Text style={styles.description}>
            La política se abrirá en el navegador de tu dispositivo.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleOpenPrivacy()}
            style={({ pressed }) => [styles.openButton, pressed && styles.pressed]}>
            <Text style={styles.openButtonText}>↗  Ver Política de Privacidad</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  backText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  headerLabel: { color: colors.text, fontFamily: fonts.display, fontSize: 13, letterSpacing: 0.8 },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...cardElevation,
  },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24, textAlign: 'center' },
  description: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  openButton: {
    minHeight: 48,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  openButtonText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 15 },
  pressed: { opacity: 0.75 },
});
