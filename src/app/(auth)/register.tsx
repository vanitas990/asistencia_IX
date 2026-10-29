import { Link, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
  facultad: '',
  carrera: '',
  password: '',
  rol: 'alumno',
};

export default function RegisterScreen() {
  const { register, authError, clearAuthError, isLoading, user } = useAuth();
  const userId = user?.id;
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isConsultingStudent, setIsConsultingStudent] = useState(false);
  const [studentDataDni, setStudentDataDni] = useState<string | null>(null);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const studentLookupRequest = useRef(0);

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(app)/home');
    }
  }, [isLoading, userId]);

  function updateField<K extends keyof RegisterFormData>(field: K, value: RegisterFormData[K]) {
    if (field === 'dni' && typeof value === 'string') {
      studentLookupRequest.current += 1;
      setIsConsultingStudent(false);
      setStudentDataDni(null);
      setForm((current) => ({
        ...current,
        dni: value,
        ...(current.rol === 'alumno'
          ? { nombre: '', facultad: '', carrera: '' }
          : {}),
      }));
      setFormError(null);
      clearAuthError();
      if (form.rol === 'alumno' && /^\d{8}$/.test(value)) {
        void handleConsultStudent(value);
      }
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
    clearAuthError();
  }

  async function handleConsultStudent(dni = form.dni) {
    if (!/^\d{8}$/.test(dni)) {
      setFormError('Ingresa un DNI de 8 dígitos para consultar los datos.');
      return;
    }

    const requestId = ++studentLookupRequest.current;
    setIsConsultingStudent(true);
    setFormError(null);
    setStudentDataDni(null);
    try {
      const student = await consultStudentByDni(dni);
      if (requestId !== studentLookupRequest.current) return;
      setForm((current) => current.dni === dni
        ? {
          ...current,
          nombre: student.nombre,
          facultad: student.facultad,
          carrera: student.carrera,
        }
        : current);
      setStudentDataDni(dni);
    } catch (lookupError) {
      if (requestId === studentLookupRequest.current) {
        setStudentDataDni(null);
        setFormError(lookupError instanceof Error ? lookupError.message : 'No se pudieron consultar los datos.');
      }
    } finally {
      if (requestId === studentLookupRequest.current) {
        setIsConsultingStudent(false);
      }
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
      let payload: RegisterFormData;
      if (result.data.rol === 'supervisor') {
        const { facultad: _facultad, ...supervisorData } = result.data;
        payload = supervisorData;
        console.log('Payload Supervisor (datos sensibles redactados):', JSON.stringify({
          ...supervisorData,
          dni: `******${supervisorData.dni.slice(-2)}`,
          nombre: '[REDACTED]',
          carrera: supervisorData.carrera ? '[PRESENTE]' : '[VACÍO]',
          password: '[REDACTED]',
        }));
      } else {
        payload = result.data;
      }
      await register(payload);
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
        {field === 'password' ? (
          <View style={styles.passwordInput}>
            <TextInput
              autoCapitalize="none"
              onChangeText={(value) => updateField(field, value)}
              editable={editable}
              placeholder={placeholder}
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              style={styles.passwordTextInput}
              value={form.password}
            />
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onPress={() => setShowPassword((current) => !current)}
              style={styles.passwordVisibilityButton}>
              <SymbolView
                name={{
                  ios: showPassword ? 'eye.slash' : 'eye',
                  android: showPassword ? 'visibility_off' : 'visibility',
                  web: showPassword ? 'visibility_off' : 'visibility',
                }}
                size={22}
                tintColor={colors.primary}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <TextInput
            autoCapitalize={field === 'dni' ? 'none' : 'words'}
            onChangeText={(value) => updateField(field, value)}
            editable={editable}
            keyboardType={field === 'dni' ? 'number-pad' : 'default'}
            maxLength={field === 'dni' ? 8 : undefined}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            style={[styles.input, !editable && styles.readOnlyInput]}
            value={form[field] ?? ''}
          />
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
          {renderInput('nombre', 'Nombres y Apellidos', 'Escribe tus nombres y apellidos', false, form.rol === 'supervisor')}
          {form.rol === 'alumno' ? (
            <>
              {renderInput('facultad', 'Facultad', 'Nombre de la facultad', false, false)}
              {renderInput('carrera', 'Carrera', 'Nombre de la carrera', false, false)}
            </>
          ) : (
            renderInput('carrera', 'Especialidad / Área', 'Tu especialidad o área')
          )}
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
                    const currentDni = form.dni;
                    studentLookupRequest.current += 1;
                    setIsConsultingStudent(false);
                    setStudentDataDni(null);
                    setForm((current) => ({
                      ...current,
                      rol: role,
                      nombre: role === 'alumno' ? '' : current.nombre,
                      facultad: '',
                      carrera: role === 'alumno' ? '' : current.carrera,
                    }));
                    setFormError(null);
                    clearAuthError();
                    if (role === 'alumno' && /^\d{8}$/.test(currentDni)) {
                      void handleConsultStudent(currentDni);
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
  passwordInput: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingLeft: 14,
    backgroundColor: colors.surfaceMuted,
  },
  passwordTextInput: {
    minHeight: 46,
    flex: 1,
    paddingVertical: 0,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  passwordVisibilityButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
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
