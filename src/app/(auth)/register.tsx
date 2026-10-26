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
import { consultStudentByDni } from '@/services/student-api';
import type { UserRole } from '@/types';
import { cardElevation, colors, fonts } from '@/theme';

const emptyForm: RegisterFormData = {
  dni: '',
  nombre: '',
  apellido: '',
  facultad: '',
  carrera: '',
  ciclo: '',
  password: '',
  rol: 'alumno',
};

export default function RegisterScreen() {
  const { register, authError, clearAuthError, isLoading, user } = useAuth();
  const userId = user?.id;
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConsultingStudent, setIsConsultingStudent] = useState(false);
  const [studentDataDni, setStudentDataDni] = useState<string | null>(null);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(app)/home');
    }
  }, [isLoading, userId]);

  function updateField<K extends keyof RegisterFormData>(field: K, value: RegisterFormData[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'dni') {
      setStudentDataDni(null);
      setForm((current) => ({
        ...current,
        nombre: current.rol === 'alumno' ? '' : current.nombre,
        apellido: current.rol === 'alumno' ? '' : current.apellido,
        facultad: current.rol === 'alumno' ? '' : current.facultad,
        carrera: current.rol === 'alumno' ? '' : current.carrera,
        ciclo: current.rol === 'alumno' ? '' : current.ciclo,
      }));
    }
    setFormError(null);
    clearAuthError();
  }

  async function handleConsultStudent() {
    if (!/^\d{8}$/.test(form.dni)) {
      setFormError('Ingresa un DNI de 8 dígitos para consultar los datos.');
      return;
    }

    setIsConsultingStudent(true);
    setFormError(null);
    setStudentDataDni(null);
    const requestedDni = form.dni;
    try {
      const student = await consultStudentByDni(requestedDni);
      setForm((current) => current.dni === requestedDni
        ? {
          ...current,
          nombre: student.nombres,
          apellido: student.apellidos,
          facultad: student.facultad,
          carrera: student.carrera,
          ciclo: student.ciclo,
        }
        : current);
      setStudentDataDni(requestedDni);
    } catch (lookupError) {
      setStudentDataDni(null);
      setFormError(lookupError instanceof Error ? lookupError.message : 'No se pudieron consultar los datos.');
    } finally {
      setIsConsultingStudent(false);
    }
  }

  async function handleSubmit() {
    if (!acceptedPolicy) {
      setFormError('Debes aceptar las Políticas y Privacidad para crear tu cuenta.');
      return;
    }

    if (form.rol === 'alumno' && studentDataDni !== form.dni) {
      setFormError('Consulta el DNI para cargar los datos del alumno antes de crear la cuenta.');
      return;
    }

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
    editable = true,
  ) {
    return (
      <View style={styles.field} key={field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          autoCapitalize={field === 'password' || field === 'dni' ? 'none' : 'words'}
          onChangeText={(value) => updateField(field, value)}
          editable={editable}
          keyboardType={field === 'dni' ? 'number-pad' : 'default'}
          maxLength={field === 'dni' ? 8 : undefined}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={secureTextEntry}
          style={[styles.input, !editable && styles.readOnlyInput]}
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

          {renderInput('dni', 'DNI', 'DNI de 8 dígitos')}
          {form.rol === 'alumno' && (
            <Pressable
              accessibilityRole="button"
              disabled={isConsultingStudent}
              onPress={() => void handleConsultStudent()}
              style={({ pressed }) => [styles.lookupButton, pressed && styles.pressed, isConsultingStudent && styles.disabled]}>
              {isConsultingStudent ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.lookupButtonText}>
                  {studentDataDni === form.dni ? 'Consultar nuevamente' : 'Consultar datos universitarios'}
                </Text>
              )}
            </Pressable>
          )}
          {renderInput('nombre', 'Nombres', 'Tus nombres', false, form.rol !== 'alumno' || studentDataDni === form.dni)}
          {renderInput('apellido', 'Apellidos', 'Tus apellidos', false, form.rol !== 'alumno' || studentDataDni === form.dni)}
          {renderInput('facultad', 'Facultad', 'Nombre de la facultad', false, form.rol !== 'alumno' || studentDataDni === form.dni)}
          {renderInput('carrera', 'Carrera', 'Nombre de la carrera', false, form.rol !== 'alumno' || studentDataDni === form.dni)}
          {renderInput('ciclo', 'Ciclo', 'Ej. V', false, form.rol !== 'alumno' || studentDataDni === form.dni)}
          {renderInput('password', 'Contraseña', 'Mínimo 6 caracteres', true)}

          <Text style={styles.label}>Tipo de cuenta</Text>
          <View style={styles.roleOptions}>
            {(['supervisor', 'alumno'] as const).map((role: UserRole) => {
              const selected = form.rol === role;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  key={role}
                  onPress={() => {
                    updateField('rol', role);
                    if (role === 'alumno') {
                      setStudentDataDni(null);
                      setForm((current) => ({
                        ...current,
                        nombre: '',
                        apellido: '',
                        facultad: '',
                        carrera: '',
                        ciclo: '',
                      }));
                    }
                  }}
                  style={[styles.roleButton, selected && styles.roleButtonSelected]}>
                  <Text style={[styles.roleText, selected && styles.roleTextSelected]}>
                    {role === 'supervisor' ? 'Supervisor' : 'Alumno'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {(formError || authError) && <Text style={styles.error}>{formError ?? authError}</Text>}

          <View style={styles.consentRow}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel="Acepto las Políticas y Privacidad"
              accessibilityState={{ checked: acceptedPolicy }}
              onPress={() => {
                setAcceptedPolicy((current) => !current);
                setFormError(null);
              }}
              style={({ pressed }) => [styles.checkbox, acceptedPolicy && styles.checkboxChecked, pressed && styles.pressed]}>
              {acceptedPolicy && <Text style={styles.checkboxCheck}>✓</Text>}
            </Pressable>
            <View style={styles.consentText}>
              <Text style={styles.consentLabel}>Acepto las </Text>
              <Link href="/politicas" style={styles.policyLink}>
                Políticas y Privacidad
              </Link>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting || !acceptedPolicy}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [styles.button, pressed && styles.pressed, (isSubmitting || !acceptedPolicy) && styles.disabled]}>
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
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...cardElevation,
  },
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
    backgroundColor: colors.surfaceMuted,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  readOnlyInput: { opacity: 0.75 },
  lookupButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  lookupButtonText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 },
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
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 7,
    backgroundColor: colors.surface,
  },
  checkboxChecked: { backgroundColor: colors.primary },
  checkboxCheck: { color: colors.surface, fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
  consentText: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  consentLabel: { color: colors.text, fontFamily: fonts.body, fontSize: 13 },
  policyLink: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13, textDecorationLine: 'underline' },
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
  disabled: { opacity: 0.48 },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 },
  footerText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  link: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
