import { BlurView } from 'expo-blur';
import { Link, router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { z } from 'zod';

import { FondoBlurContext } from '@/components/FondoAnimado';
import { useAuth } from '@/context/AuthContext';
import type { RegisterFormData } from '@/schemas/auth.schema';
import { fonts } from '@/theme';

const manualRegistrationSchema = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos.'),
  nombre: z.string().trim().min(1, 'Ingresa tus nombres y apellidos completos.').max(150),
  facultad: z.string().trim().min(1, 'Ingresa tu facultad.').max(150),
  correo_institucional: z.union([
    z.literal(''),
    z.string().trim().email('Ingresa un correo institucional válido.').max(254),
  ]),
  correo_personal: z.union([
    z.literal(''),
    z.string().trim().email('Ingresa un correo personal válido.').max(254),
  ]),
  telefono: z.string().trim().min(7, 'Ingresa un teléfono válido.').max(20),
});

type ManualRegistrationForm = z.infer<typeof manualRegistrationSchema>;
type RegistrationRole = 'alumno' | 'supervisor';

const emptyForm: ManualRegistrationForm = {
  dni: '',
  nombre: '',
  facultad: '',
  correo_institucional: '',
  correo_personal: '',
  telefono: '',
};

const fields: {
  name: 'dni' | 'nombre' | 'facultad' | 'telefono';
  label: string;
  placeholder: string;
  keyboardType: 'default' | 'number-pad' | 'email-address' | 'phone-pad';
  autoCapitalize: 'none' | 'words';
  maxLength: number;
}[] = [
  { name: 'dni', label: 'DNI', placeholder: 'DNI de 8 dígitos', keyboardType: 'number-pad', autoCapitalize: 'none', maxLength: 8 },
  { name: 'nombre', label: 'Nombres y Apellidos', placeholder: 'Nombres y Apellidos completos', keyboardType: 'default', autoCapitalize: 'words', maxLength: 150 },
  { name: 'facultad', label: 'Facultad', placeholder: 'Nombre de la facultad', keyboardType: 'default', autoCapitalize: 'words', maxLength: 150 },
  { name: 'telefono', label: 'Teléfono', placeholder: 'Número de celular', keyboardType: 'phone-pad', autoCapitalize: 'none', maxLength: 20 },
];

export default function RegisterScreen() {
  const { isLoading, user, register } = useAuth();
  const blurTarget = useContext(FondoBlurContext);
  const userId = user?.id;
  const [form, setForm] = useState(emptyForm);
  const [role, setRole] = useState<RegistrationRole>('alumno');
  const [correoPreferido, setCorreoPreferido] = useState<'institucional' | 'personal'>('institucional');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(app)/home');
    }
  }, [isLoading, userId]);

  function updateField(field: keyof ManualRegistrationForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError(null);
  }

  async function handleSubmit() {
    if (isSubmitting) return;

    if (!acceptedPolicy) {
      setFormError('Debes aceptar las Políticas y Privacidad para crear tu cuenta.');
      return;
    }

    const result = manualRegistrationSchema.safeParse(form);
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? 'Revisa los datos ingresados.');
      return;
    }

    if (role === 'supervisor' && password.length < 6) {
      setFormError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (role === 'supervisor' && password.length > 128) {
      setFormError('La contraseña no puede superar 128 caracteres.');
      return;
    }
    if (role === 'alumno' && !form.correo_institucional.trim() && !form.correo_personal.trim()) {
      setFormError('Ingresa al menos un correo electrónico.');
      return;
    }
    if (role === 'supervisor' && !form.correo_personal.trim()) {
      setFormError('Ingresa un correo de contacto.');
      return;
    }
    if (role === 'alumno'
      && (correoPreferido === 'institucional'
        ? !form.correo_institucional.trim()
        : !form.correo_personal.trim())) {
      setFormError('Selecciona como preferido un correo que hayas ingresado.');
      return;
    }
    const registrationPayload: RegisterFormData = {
      ...result.data,
      facultad: role === 'supervisor' ? null : result.data.facultad,
      carrera: role === 'supervisor' ? result.data.facultad : 'Por asignar',
      correo_institucional: result.data.correo_institucional || null,
      correo_personal: result.data.correo_personal || null,
      correo_preferido: role === 'supervisor' ? 'personal' : correoPreferido,
      origen_datos: 'manual',
      password: role === 'supervisor' ? password : result.data.dni,
      rol: role,
    };

    setIsSubmitting(true);
    try {
      await register(registrationPayload);
      router.replace('/(app)/home');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo crear la cuenta. Inténtalo nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || userId) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }
  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, styles.keyboardContent]}
      enableOnAndroid
      extraScrollHeight={20}
      keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <BlurView
            blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            blurTarget={Platform.OS === 'android' ? blurTarget ?? undefined : undefined}
            intensity={80}
            pointerEvents="none"
            style={[styles.cardBlur, Platform.OS === 'web' && styles.webCardBlur]}
            tint="dark"
          />
          <View style={styles.cardContent}>
            <Text style={styles.eyebrow}>ASISTENCIA IX</Text>
            <View accessibilityRole="tablist" style={styles.roleSelector}>
              {(['alumno', 'supervisor'] as const).map((nextRole) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: role === nextRole }}
                  key={nextRole}
                  onPress={() => {
                    setRole(nextRole);
                    setFormError(null);
                  }}
                  style={styles.roleOption}>
                  <Text style={[styles.roleText, role === nextRole && styles.roleTextActive]}>
                    {nextRole === 'alumno' ? 'Alumno' : 'Supervisor'}
                  </Text>
                  <View
                    style={[
                      styles.roleUnderline,
                      role === nextRole && styles.roleUnderlineActive,
                    ]}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>Completa tus datos para comenzar.</Text>

            {fields.map((field) => (
              <View key={field.name} style={styles.field}>
                <Text style={styles.label}>
                  {field.name === 'facultad' && role === 'supervisor'
                    ? 'Especialidad / Área'
                    : field.label}
                </Text>
                <TextInput
                  accessibilityLabel={field.label}
                  autoCapitalize={field.autoCapitalize}
                  autoCorrect={field.name === 'nombre' || field.name === 'facultad'}
                  keyboardType={field.keyboardType}
                  maxLength={field.maxLength}
                  onChangeText={(value) => updateField(
                    field.name,
                    field.name === 'dni' ? value.replace(/\D/g, '') : value,
                  )}
                  placeholder={
                    field.name === 'facultad' && role === 'supervisor'
                      ? 'Ej. Sistemas, Administración, etc.'
                      : field.placeholder
                  }
                  placeholderTextColor="rgba(255, 255, 255, 0.72)"
                  style={styles.input}
                  value={form[field.name]}
                />
              </View>
            ))}

            {role === 'alumno' && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Correo Institucional</Text>
                  <TextInput
                    accessibilityLabel="Correo Institucional"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    maxLength={254}
                    onChangeText={(value) => updateField('correo_institucional', value)}
                    placeholder="correo@unheval.edu.pe"
                    placeholderTextColor="rgba(255, 255, 255, 0.72)"
                    style={styles.input}
                    value={form.correo_institucional}
                  />
                  <Text style={styles.fieldHint}>(Sugerencia: @unheval.edu.pe)</Text>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Correo Personal</Text>
                  <TextInput
                    accessibilityLabel="Correo Personal"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    maxLength={254}
                    onChangeText={(value) => updateField('correo_personal', value)}
                    placeholder="correo@ejemplo.com"
                    placeholderTextColor="rgba(255, 255, 255, 0.72)"
                    style={styles.input}
                    value={form.correo_personal}
                  />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Correo preferido para contacto</Text>
                  <View accessibilityRole="radiogroup" style={styles.emailPreferenceOptions}>
                    {(['institucional', 'personal'] as const).map((preference) => (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: correoPreferido === preference }}
                        key={preference}
                        onPress={() => setCorreoPreferido(preference)}
                        style={[
                          styles.emailPreferenceOption,
                          correoPreferido === preference && styles.emailPreferenceOptionSelected,
                        ]}>
                        <Text style={styles.emailPreferenceText}>
                          {preference === 'institucional' ? 'Institucional' : 'Personal'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </>
            )}

            {role === 'supervisor' && (
              <View style={styles.field}>
                <Text style={styles.label}>Correo de Contacto</Text>
                <TextInput
                  accessibilityLabel="Correo de Contacto"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  maxLength={254}
                  onChangeText={(value) => updateField('correo_personal', value)}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="rgba(255, 255, 255, 0.72)"
                  style={styles.input}
                  value={form.correo_personal}
                />
              </View>
            )}

            {role === 'supervisor' && (
              <View style={styles.field}>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  accessibilityLabel="Contraseña"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={(value) => {
                    setPassword(value);
                    setFormError(null);
                  }}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="rgba(255, 255, 255, 0.72)"
                  secureTextEntry
                  style={styles.input}
                  value={password}
                  maxLength={128}
                />
              </View>
            )}

            {formError && (
              <Text accessibilityRole="alert" style={styles.error}>
                {formError}
              </Text>
            )}

            <View style={styles.consentRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Acepto las Políticas y Privacidad"
                accessibilityState={{ checked: acceptedPolicy }}
                onPress={() => {
                  setAcceptedPolicy((current) => !current);
                  setFormError(null);
                }}
                style={({ pressed }) => [
                  styles.checkbox,
                  acceptedPolicy && styles.checkboxChecked,
                  pressed && styles.pressed,
                ]}>
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
              disabled={!acceptedPolicy || isSubmitting}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.pressed,
                (!acceptedPolicy || isSubmitting) && styles.disabled,
              ]}>
              <Text style={styles.buttonText}>
                {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
              </Text>
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
              <Link href="/(auth)/login" style={styles.link}>
                Iniciar sesión
              </Link>
            </View>
          </View>
        </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  keyboardContent: { paddingBottom: 40 },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  cardBlur: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    zIndex: 0,
  },
  webCardBlur: { opacity: 0.12 },
  cardContent: { gap: 14, padding: 22, zIndex: 1 },
  roleSelector: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 2 },
  roleOption: { width: 120, alignItems: 'center', gap: 8 },
  roleText: { color: '#D0D0D0', fontFamily: fonts.medium, fontSize: 14 },
  roleTextActive: { color: '#FFFFFF', fontFamily: fonts.semibold },
  roleUnderline: { height: 2, width: '100%', backgroundColor: 'transparent' },
  roleUnderlineActive: { backgroundColor: '#FFFFFF' },
  eyebrow: { color: '#D8C1A5', fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1.5 },
  title: { color: '#FFFFFF', fontFamily: fonts.display, fontSize: 30 },
  subtitle: { color: '#E0E0E0', fontFamily: fonts.body, fontSize: 15, marginBottom: 4 },
  field: { gap: 6 },
  fieldHint: { color: '#E0E0E0', fontFamily: fonts.body, fontSize: 11 },
  label: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 14, marginTop: 4 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    fontFamily: fonts.body,
    fontSize: 16,
  },
  error: { color: '#FFB4AB', fontFamily: fonts.medium, fontSize: 13 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  checkboxChecked: { backgroundColor: '#FFFFFF' },
  checkboxCheck: { color: '#17211D', fontFamily: fonts.bold, fontSize: 16, lineHeight: 20 },
  consentText: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  consentLabel: { color: '#E0E0E0', fontFamily: fonts.body, fontSize: 13 },
  policyLink: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 13, textDecorationLine: 'underline' },
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
  },
  buttonText: { color: '#17211D', fontFamily: fonts.semibold, fontSize: 16 },
  supervisorNotice: { padding: 12, borderWidth: 1, borderColor: 'rgba(216, 193, 165, 0.38)', borderRadius: 12, color: '#E0E0E0', backgroundColor: 'rgba(255, 255, 255, 0.07)', fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  emailPreferenceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emailPreferenceOption: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.32)', borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  emailPreferenceOptionSelected: { borderColor: '#D8C1A5', backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  emailPreferenceText: { color: '#FFFFFF', fontFamily: fonts.medium, fontSize: 13 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.58 },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 },
  footerText: { color: '#E0E0E0', fontFamily: fonts.body, fontSize: 14 },
  link: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 14 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
});
