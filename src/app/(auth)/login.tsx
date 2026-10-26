import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema';
import { cardElevation, colors, fonts } from '@/theme';

export default function LoginScreen() {
  const { login, authError, clearAuthError, isLoading, user } = useAuth();
  const userId = user?.id;
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(app)/home');
    }
  }, [isLoading, userId]);

  async function handleSubmit() {
    const result = loginSchema.safeParse({ dni, password } satisfies LoginFormData);
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? 'Revisa los datos ingresados.');
      return;
    }

    setFormError(null);
    clearAuthError();
    setIsSubmitting(true);
    try {
      await login(result.data);
      router.replace('/(app)/home');
    } catch {
      // AuthContext exposes the mock storage error for display.
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || userId) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ASISTENCIA IX</Text>
        <Text style={styles.title}>Iniciar sesión</Text>
        <Text style={styles.subtitle}>Ingresa tu DNI y contraseña.</Text>

        <Text style={styles.label}>DNI</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          maxLength={8}
          onChangeText={(value) => {
            setDni(value.replace(/\D/g, ''));
            setFormError(null);
            clearAuthError();
          }}
          placeholder="Tu DNI de 8 dígitos"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={dni}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => {
            setPassword(value);
            setFormError(null);
            clearAuthError();
          }}
          onSubmitEditing={() => void handleSubmit()}
          placeholder="Tu contraseña"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {(formError || authError) && <Text style={styles.error}>{formError ?? authError}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={() => void handleSubmit()}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, isSubmitting && styles.disabled]}>
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </Pressable>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Aún no tienes cuenta? </Text>
          <Link href="/(auth)/register" style={styles.link}>
            Crear cuenta
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...cardElevation,
  },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.5 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 30 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, marginBottom: 12 },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 14, marginTop: 4 },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  error: { color: '#b91c1c', fontSize: 14 },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 8,
    ...cardElevation,
  },
  buttonText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 16 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 10 },
  footerText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  link: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
