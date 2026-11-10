import { BlurView } from 'expo-blur';
import { Link } from 'expo-router';
import { useContext, useState } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { z } from 'zod';

import { FondoBlurContext } from '@/components/FondoAnimado';
import { colors, fonts } from '@/theme';

export default function ForgotPasswordScreen() {
  const blurTarget = useContext(FondoBlurContext);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function showMessage(title: string, message: string) {
    if (Platform.OS === 'web') {
      globalThis.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  }

  function sendCode() {
    const result = z.string().email('Ingresa un correo válido.').safeParse(email.trim());
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Ingresa un correo válido.');
      return;
    }

    // TODO: Conectar con el endpoint de recuperación y envío de códigos por correo
    setEmail(result.data);
    setCode('');
    setIsCodeSent(true);
    setError(null);
    showMessage('Recuperación de contraseña', `Código enviado a ${result.data} (Simulación)`);
  }

  function verifyCode() {
    if (!/^\d{6}$/.test(code)) {
      setError('Ingresa el código de 6 dígitos.');
      return;
    }

    // TODO: Conectar con el endpoint de verificación del código de recuperación
    setError(null);
    showMessage(
      'Código verificado',
      'La verificación es una simulación. El restablecimiento de contraseña requiere conexión con el backend.',
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
            <Text style={styles.title}>Recuperar contraseña</Text>
            <Text style={styles.subtitle}>
              Te enviaremos un código de verificación al correo asociado a tu cuenta.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Correo Electrónico</Text>
              <TextInput
                accessibilityLabel="Correo Electrónico"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                maxLength={254}
                onChangeText={(value) => {
                  setEmail(value);
                  setError(null);
                }}
                placeholder="correo@ejemplo.com"
                placeholderTextColor="rgba(255, 255, 255, 0.72)"
                style={styles.input}
                value={email}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={sendCode}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>
                {isCodeSent ? 'Reenviar código' : 'Enviar código'}
              </Text>
            </Pressable>

            {isCodeSent && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Código de 6 dígitos</Text>
                  <TextInput
                    accessibilityLabel="Código de 6 dígitos"
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={(value) => {
                      setCode(value.replace(/\D/g, ''));
                      setError(null);
                    }}
                    placeholder="000000"
                    placeholderTextColor="rgba(255, 255, 255, 0.72)"
                    style={styles.input}
                    value={code}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={verifyCode}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>Verificar código</Text>
                </Pressable>
              </>
            )}

            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

            <View style={styles.footer}>
              <Text style={styles.footerText}>¿Recordaste tu contraseña? </Text>
              <Link href="/(auth)/login" style={styles.link}>Volver al inicio de sesión</Link>
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
  cardContent: { gap: 16, padding: 24, zIndex: 1 },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.4 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 29 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  field: { gap: 7 },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  input: {
    minHeight: 48,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 12,
    color: colors.text,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    fontFamily: fonts.body,
    fontSize: 15,
  },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF' },
  primaryButtonText: { color: '#17211D', fontFamily: fonts.semibold, fontSize: 15 },
  secondaryButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)' },
  secondaryButtonText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  error: { color: colors.danger, fontFamily: fonts.medium, fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: 4 },
  footerText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  link: { color: colors.text, fontFamily: fonts.semibold, fontSize: 12, textDecorationLine: 'underline' },
  pressed: { opacity: 0.82 },
});
