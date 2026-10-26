import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { registerSchema, type RegisterFormData } from '@/schemas/auth.schema';
import type { UserRole } from '@/types';
import { colors, fonts } from '@/theme';

const emptyForm: RegisterFormData = {
  nombre: '',
  apellido: '',
  curso_carrera: '',
  institucion: '',
  password: '',
  rol: 'practicante',
};

export default function RegisterScreen() {
  const { register, authError, clearAuthError, isLoading, user } = useAuth();
  const userId = user?.id;
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(app)/home');
    }
  }, [isLoading, userId]);

  function updateField<K extends keyof RegisterFormData>(field: K, value: RegisterFormData[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    clearAuthError();
  }

  async function handleSubmit() {
    const result = registerSchema.safeParse(form satisfies RegisterFormData);
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? 'Revisa los datos ingresados.');
      return;
    }

    setFormError(null);
    clearAuthError();
    setIsSubmitting(true);
    try {
      await register(result.data);
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

  function renderInput(
    field: Exclude<keyof RegisterFormData, 'rol'>,
    label: string,
    placeholder: string,
    secureTextEntry = false,
  ) {
    return (
      <View style={styles.field} key={field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          autoCapitalize={field === 'password' ? 'none' : 'words'}
          onChangeText={(value) => updateField(field, value)}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={secureTextEntry}
          style={styles.input}
          value={form[field]}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>ASISTENCIA IX</Text>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Completa tus datos para comenzar.</Text>

          {renderInput('nombre', 'Nombre', 'Tu nombre')}
          {renderInput('apellido', 'Apellido', 'Tu apellido')}
          {renderInput('curso_carrera', 'Curso o carrera', 'Ej. Enfermería')}
          {renderInput('institucion', 'Institución', 'Nombre de la institución')}
          {renderInput('password', 'Contraseña', 'Mínimo 6 caracteres', true)}

          <Text style={styles.label}>Tipo de cuenta</Text>
          <View style={styles.roleOptions}>
            {(['supervisor', 'practicante'] as const).map((role: UserRole) => {
              const selected = form.rol === role;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={role}
                  onPress={() => updateField('rol', role)}
                  style={[styles.roleButton, selected && styles.roleButtonSelected]}>
                  <Text style={[styles.roleText, selected && styles.roleTextSelected]}>
                    {role === 'supervisor' ? 'Supervisor' : 'Practicante'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {(formError || authError) && <Text style={styles.error}>{formError ?? authError}</Text>}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [styles.button, pressed && styles.pressed, isSubmitting && styles.disabled]}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Crear cuenta</Text>
            )}
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <Link href="/(auth)/login" style={styles.link}>
              Iniciar sesión
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 12, paddingVertical: 20 },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.5 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 30 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 15, marginBottom: 8 },
  field: { gap: 6 },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 14, marginTop: 4 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  roleOptions: { flexDirection: 'row', gap: 12 },
  roleButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  roleButtonSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
  roleText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14 },
  roleTextSelected: { color: colors.primary },
  error: { color: '#b91c1c', fontSize: 14 },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 16 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.6 },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 },
  footerText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  link: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
