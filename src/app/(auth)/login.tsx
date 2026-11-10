import { BlurView } from 'expo-blur';
import { Link, router } from 'expo-router';
import { useEffect, useState, useContext } from 'react';
import { SymbolView } from 'expo-symbols';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { FondoBlurContext } from '@/components/FondoAnimado';
import { useAuth } from '@/context/AuthContext';
import { ApiRequestError } from '@/services/auth-api';
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema';
import { fonts } from '@/theme';

type LoginRole = 'alumno' | 'supervisor';

export default function LoginScreen() {
  const { login, authError, clearAuthError, isLoading, user } = useAuth();
  const blurTarget = useContext(FondoBlurContext);
  const userId = user?.id;
  const [role, setRole] = useState<LoginRole>('alumno');
  const [dni, setDni] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(app)/home');
    }
  }, [isLoading, userId]);

  async function handleSubmit() {
    const result = loginSchema.safeParse({
      dni,
      password: role === 'alumno' ? undefined : password,
      rol: role,
    } satisfies LoginFormData);
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? 'Revisa los datos ingresados.');
      return;
    }

    setFormError(null);
    clearAuthError();
    setIsSubmitting(true);

    try {
      await login({ dni, password: role === 'alumno' ? '' : password, rol: role });

      // Si el backend dice "OK", entramos al Home
      router.replace('/(app)/home');

    } catch (error: unknown) {
      // Si el alumno no aparece en Neon ni en UNHEVAL, puede continuar con el registro manual.
      if (error instanceof ApiRequestError && error.status === 404) {
        clearAuthError();
        router.push({ pathname: '/(auth)/register', params: { dni } });
      } else {
        // Si es otro error, el AuthContext ya lo mostrará en pantalla
        console.error(error);
      }
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
        <View style={styles.content}>
          <Text style={styles.brand}>ASISTENCIA IX</Text>
          <View style={styles.card}>
            <BlurView
              blurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              blurTarget={Platform.OS === 'android' ? blurTarget ?? undefined : undefined}
              intensity={80}
              pointerEvents="none"
              style={[
                styles.cardBlur,
                Platform.OS === 'web' && styles.webCardBlur,
              ]}
              tint="dark"
            />
            <View style={styles.cardContent}>
              <Text style={styles.title}>Bienvenido</Text>
              <Text style={styles.subtitle}>Ingresa tus datos para continuar</Text>

              <View accessibilityRole="tablist" style={styles.roleSelector}>
                {(['alumno', 'supervisor'] as const).map((nextRole) => (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: role === nextRole }}
                    key={nextRole}
                    onPress={() => setRole(nextRole)}
                    style={styles.roleOption}>
                    <Text style={[styles.roleText, role === nextRole && styles.roleTextActive]}>
                      {nextRole === 'alumno' ? 'Alumno' : 'Supervisor'}
                    </Text>
                    <View style={[styles.roleUnderline, role === nextRole && styles.roleUnderlineActive]} />
                  </Pressable>
                ))}
              </View>

              <TextInput
                accessibilityLabel="DNI"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                maxLength={8}
                onChangeText={(value) => {
                  setDni(value.replace(/\D/g, ''));
                  setFormError(null);
                  clearAuthError();
                }}
                placeholder="Ingresa tu DNI"
                placeholderTextColor="#FFFFFF"
                style={styles.input}
                value={dni}
              />

              {role === 'supervisor' && (
                <View style={styles.passwordInput}>
                  <TextInput
                    accessibilityLabel="Contraseña"
                    autoCapitalize="none"
                    onChangeText={(value) => {
                      setPassword(value);
                      setFormError(null);
                      clearAuthError();
                    }}
                    onSubmitEditing={() => void handleSubmit()}
                    placeholder="Ingresa tu contraseña"
                    placeholderTextColor="#FFFFFF"
                    secureTextEntry={!showPassword}
                    style={styles.passwordTextInput}
                    value={password}
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
                      size={21}
                      tintColor="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {(formError || authError) && (
                <Text accessibilityRole="alert" style={styles.error}>
                  {formError ?? authError}
                </Text>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => void handleSubmit()}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#17211D" />
                ) : (
                  <Text style={styles.buttonText}>
                    {role === 'alumno' ? 'Registrar' : 'Ingresar'}
                  </Text>
                )}
              </Pressable>

              {role === 'supervisor' && (
                <Link href="/(auth)/forgot-password" style={styles.forgotPasswordLink}>
                  ¿Olvidaste tu contraseña?
                </Link>
              )}

              <Text style={styles.supportText}>
                ¿Problemas para ingresar? Contacta a soporte
              </Text>

              <View style={styles.registerRow}>
                <Text style={styles.registerText}>¿Aún no tienes cuenta? </Text>
                <Link href="/(auth)/register" style={styles.registerLink}>
                  Crear cuenta
                </Link>
              </View>
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
  content: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 20 },
  brand: {
    color: '#FFFFFF',
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 4,
    textAlign: 'center',
  },
  card: {
    position: 'relative',
    width: '100%',
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
  cardContent: { gap: 16, padding: 24, zIndex: 1 },
  title: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 32,
    textAlign: 'center',
  },
  subtitle: {
    color: '#E0E0E0',
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
  },
  roleSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
  },
  roleOption: { width: 112, alignItems: 'center', gap: 8 },
  roleText: { color: '#D0D0D0', fontFamily: fonts.medium, fontSize: 13 },
  roleTextActive: { color: '#FFFFFF', fontFamily: fonts.semibold },
  roleUnderline: { height: 2, width: '100%', backgroundColor: 'transparent' },
  roleUnderlineActive: { backgroundColor: '#FFFFFF' },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    fontFamily: fonts.body,
    fontSize: 15,
  },
  passwordInput: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordTextInput: {
    minHeight: 48,
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    borderWidth: 0,
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    fontFamily: fonts.body,
    fontSize: 15,
  },
  passwordVisibilityButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#FFB4AB', fontFamily: fonts.medium, fontSize: 13 },
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    marginTop: 2,
  },
  buttonText: { color: '#17211D', fontFamily: fonts.semibold, fontSize: 16 },
  forgotPasswordLink: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
  supportText: { color: '#D0D0D0', fontFamily: fonts.body, fontSize: 11, textAlign: 'center' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  registerText: { color: '#E0E0E0', fontFamily: fonts.body, fontSize: 12 },
  registerLink: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 12, textDecorationLine: 'underline' },
  pressed: { opacity: 0.84 },
  disabled: { opacity: 0.6 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
});
