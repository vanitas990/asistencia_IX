import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCodeEncoder from 'qrcode';
import QRCode from 'react-native-qrcode-svg';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { generateQr, getAlumnoQr, regenerateQr } from '@/services/link-api';
import { cardElevation, colors, fonts } from '@/theme';

export default function QrScreen() {
  const { apiFetch, user } = useAuth();
  const userRole = user?.rol;
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  const loadQr = useCallback(async (isActive: () => boolean = () => isMountedRef.current) => {
    if (isActive()) setError(null);
    try {
      const qr = userRole === 'alumno'
        ? await getAlumnoQr(apiFetch)
        : await generateQr(apiFetch);
      if (!qr.token.trim()) {
        throw new Error('El servidor no devolvió un código QR válido.');
      }
      if (isActive()) setToken(qr.token);
    } catch (loadError) {
      if (isActive()) {
        console.error('No se pudo cargar el código QR.', loadError);
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el código QR.');
      }
    } finally {
      if (isActive()) setIsLoading(false);
    }
  }, [apiFetch, userRole]);

  useEffect(() => {
    let isMounted = true;
    isMountedRef.current = true;
    // State updates happen only after the asynchronous API request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQr(() => isMounted);
    return () => {
      isMounted = false;
      isMountedRef.current = false;
    };
  }, [loadQr]);

  async function handleExport() {
    if (!token) return;
    setIsExporting(true);
    setError(null);
    try {
      const svg = await QRCodeEncoder.toString(token, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 280,
      });
      const qrOwner = userRole === 'alumno' ? 'alumno' : 'supervisor';
      const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;color:#0f172a}svg{width:260px;height:260px}.token{font-size:12px;word-break:break-all;color:#475569}</style></head><body><h1>Asistencia IX</h1><p>Código QR estático del ${qrOwner}</p>${svg}<p class="token">${token}</p></body></html>`;

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const file = await Print.printToFileAsync({ html });
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error('La función para compartir archivos no está disponible en este dispositivo.');
        }
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Compartir mi código QR',
        });
      }
    } catch (exportError) {
      console.error('No se pudo exportar el código QR.', exportError);
      setError(exportError instanceof Error ? exportError.message : 'No se pudo exportar el PDF.');
    } finally {
      setIsExporting(false);
    }
  }

  function confirmRegeneration() {
    Alert.alert(
      'Regenerar código QR',
      'El QR actual dejará de funcionar. Tendrás que reemplazar las copias impresas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Regenerar',
          style: 'destructive',
          onPress: () => void handleRegenerate(),
        },
      ],
    );
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    setError(null);
    try {
      const qr = await regenerateQr(apiFetch);
      setToken(qr.token);
    } catch (regenerateError) {
      console.error('No se pudo regenerar el código QR del supervisor.', regenerateError);
      setError(regenerateError instanceof Error ? regenerateError.message : 'No se pudo regenerar el código QR.');
    } finally {
      setIsRegenerating(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ASISTENCIA IX</Text>
        <Text style={styles.title}>Mi Código QR</Text>
        <Text style={styles.subtitle}>
          {userRole === 'alumno'
            ? 'Muestra este QR a tu supervisor para vincularte.'
            : 'Comparte este QR para que los alumnos marquen su asistencia.'}
        </Text>

        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : token ? (
          <>
            <View style={styles.qrFrame}>
              <QRCode value={token} size={240} color={colors.primary} backgroundColor={colors.surface} />
            </View>
            <Text selectable style={styles.token}>{token}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={isExporting || isRegenerating}
              onPress={() => void handleExport()}
              style={({ pressed }) => [styles.button, pressed && styles.pressed, isExporting && styles.disabled]}>
              {isExporting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.buttonText}>Exportar PDF</Text>
              )}
            </Pressable>
          </>
        ) : null}

        {userRole === 'supervisor' && token && (
          <Pressable
            accessibilityRole="button"
            disabled={isRegenerating || isExporting}
            onPress={confirmRegeneration}
            style={({ pressed }) => [
              styles.dangerButton,
              pressed && styles.pressed,
              (isRegenerating || isExporting) && styles.disabled,
            ]}>
            {isRegenerating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Regenerar QR</Text>
            )}
          </Pressable>
        )}

        <Pressable
          accessibilityRole="button"
          disabled={isLoading}
          onPress={() => {
            setIsLoading(true);
            void loadQr();
          }}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, isLoading && styles.disabled]}>
          <Text style={styles.secondaryButtonText}>Actualizar QR</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: colors.background },
  card: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 16,
    ...cardElevation,
  },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 25, textAlign: 'center' },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  qrFrame: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  token: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, textAlign: 'center' },
  button: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, ...cardElevation },
  buttonText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 15 },
  secondaryButton: { minHeight: 48, width: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 },
  dangerButton: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#b91c1c' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});
