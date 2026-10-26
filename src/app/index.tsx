import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { cardElevation, colors, fonts } from '@/theme';

export default function WelcomeScreen() {
  const { user, isLoading, authError, clearAuthError } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(app)/home');
    }
  }, [isLoading, userId]);

  if (isLoading || userId) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.mark}>
          <Text style={styles.markText}>⌖</Text>
        </View>

        <Text style={styles.eyebrow}>ASISTENCIA IX</Text>
        <Text style={styles.title}>Tu asistencia,{"\n"}más simple.</Text>
        <Text style={styles.subtitle}>
          Registra y consulta tu asistencia de forma rápida y segura.
        </Text>

        {authError && (
          <Pressable onPress={clearAuthError}>
            <Text style={styles.error}>{authError}</Text>
          </Pressable>
        )}

        <View style={styles.buttonContainer}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.secondaryButtonText}>Crear cuenta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    alignItems: 'center',
    padding: 26,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...cardElevation,
  },
  mark: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 38,
    borderWidth: 1,
    borderColor: colors.earth,
    backgroundColor: colors.earthLight,
    marginBottom: 20,
  },
  markText: { color: colors.primary, fontFamily: fonts.display, fontSize: 43 },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.7, marginBottom: 8 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 32, textAlign: 'center', lineHeight: 40, marginBottom: 12 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 30 },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
    ...cardElevation,
  },
  primaryButtonText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 16 },
  secondaryButton: {
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 16 },
  pressed: { opacity: 0.8 },
  error: { color: colors.danger, fontFamily: fonts.body, textAlign: 'center', fontSize: 14, marginBottom: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});