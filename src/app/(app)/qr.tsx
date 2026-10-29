import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';

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
  const qrCardRef = useRef<ViewShotRef | null>(null);

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
        setError('load');
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

  async function captureQrCard() {
    if (!token || !qrCardRef.current) {
      throw new Error('La tarjeta con el código QR todavía no está lista.');
    }

    return captureRef(qrCardRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
  }

  async function handleExportAndShare() {
    if (Platform.OS === 'web') {
      console.error('La exportación de imágenes QR está disponible en builds nativas.');
      return;
    }
    setIsExporting(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('La función para compartir archivos no está disponible en este dispositivo.');
      }
      const fileUri = await captureQrCard();
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir tarjeta QR',
      });
    } catch (shareError) {
      console.error('No se pudo capturar o compartir la tarjeta QR.', shareError);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSaveToGallery() {
    if (Platform.OS === 'web') {
      console.error('Guardar imágenes QR en la galería está disponible en builds nativas.');
      return;
    }

    setIsExporting(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        Alert.alert('Permiso denegado', 'Permite el acceso a fotos para guardar el QR en tu galería.');
        return;
      }

      const fileUri = await captureQrCard();
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert('¡Éxito!', 'El QR se guardó en tu galería.');
    } catch (saveError) {
      console.error('No se pudo capturar o guardar la tarjeta QR en la galería.', saveError);
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
      setError('load');
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

        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : token ? (
          <>
            <View style={styles.qrFrame}>
              <QRCode value={token} size={240} color="#000000" backgroundColor="#FFFFFF" />
            </View>
            <Text selectable style={styles.token}>{token}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={isExporting || isRegenerating}
              onPress={() => void handleSaveToGallery()}
              style={({ pressed }) => [styles.button, pressed && styles.pressed, isExporting && styles.disabled]}>
              {isExporting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Guardar en Galería</Text>}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isExporting || isRegenerating}
              onPress={() => void handleExportAndShare()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, (isExporting || isRegenerating) && styles.disabled]}>
              {isExporting ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Compartir</Text>}
            </Pressable>
          </>
        ) : null}

        {token && (
          <ViewShot
            ref={qrCardRef}
            style={styles.capturePosition}>
            <View style={styles.printCard}>
              <Text style={styles.printTitle}>MARCA TU ASISTENCIA</Text>
              <View style={styles.printQrFrame}>
                <QRCode value={token} size={250} color="#000000" backgroundColor="#FFFFFF" />
              </View>
              <Text style={styles.printFooter}>ASISTENCIA IX</Text>
            </View>
          </ViewShot>
        )}

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
          <Text style={styles.secondaryButtonText}>{error ? 'Reintentar' : 'Actualizar QR'}</Text>
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
  capturePosition: { position: 'absolute', left: -10000, top: 0 },
  printCard: {
    width: 330,
    minHeight: 390,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    padding: 28,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
  },
  printTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: 23, textAlign: 'center' },
  printQrFrame: { padding: 20, borderRadius: 18, backgroundColor: '#FFFFFF' },
  printFooter: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 2 },
  button: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, ...cardElevation },
  buttonText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 15 },
  secondaryButton: { minHeight: 48, width: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 },
  dangerButton: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#b91c1c' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});
