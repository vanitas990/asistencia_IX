import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { generateQr, getAlumnoQr, regenerateQr } from '@/services/link-api';
import { cardElevation, colors, fonts } from '@/theme';

type QrSvgRef = {
  toDataURL: (callback: (base64: string) => void) => void;
};

export default function QrScreen() {
  const { apiFetch, user } = useAuth();
  const userRole = user?.rol;
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  const qrRef = useRef<QrSvgRef | null>(null);

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

  async function getQrBase64() {
    const qr = qrRef.current;
    if (!token || !qr) {
      throw new Error('El código QR todavía no está listo para exportar.');
    }

    return new Promise<string>((resolve, reject) => {
      try {
        qr.toDataURL((base64) => {
          if (!base64) {
            reject(new Error('No se pudo generar la imagen del código QR.'));
            return;
          }
          resolve(base64);
        });
      } catch (qrError) {
        reject(qrError);
      }
    });
  }

  async function writeQrImage() {
    if (Platform.OS === 'web') {
      throw new Error('Guardar o compartir una imagen QR desde el almacenamiento local no está disponible en web.');
    }
    if (!FileSystem.cacheDirectory) {
      throw new Error('No se encontró el directorio temporal para guardar el código QR.');
    }

    const base64 = await getQrBase64();
    const fileUri = `${FileSystem.cacheDirectory}qr_alumno.png`;
    await FileSystem.writeAsStringAsync(fileUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fileUri;
  }

  async function handleSaveToGallery() {
    setIsExporting(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        console.error('No se concedió permiso para guardar el código QR en la galería.');
        return;
      }

      const fileUri = await writeQrImage();
      await MediaLibrary.saveToLibraryAsync(fileUri);
      Alert.alert('QR guardado', 'El código QR se guardó en tu galería.');
    } catch (saveError) {
      console.error('No se pudo guardar el código QR en la galería.', saveError);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleShare() {
    setIsExporting(true);
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('La función para compartir archivos no está disponible en este dispositivo.');
      }
      const fileUri = await writeQrImage();
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartir mi QR',
      });
    } catch (shareError) {
      console.error('No se pudo compartir el código QR.', shareError);
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
              <QRCode
                getRef={(instance) => {
                  qrRef.current = instance && typeof instance.toDataURL === 'function'
                    ? instance
                    : null;
                }}
                value={token}
                size={240}
                color={colors.primary}
                backgroundColor={colors.surface}
              />
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
              onPress={() => void handleShare()}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, (isExporting || isRegenerating) && styles.disabled]}>
              <Text style={styles.secondaryButtonText}>Compartir</Text>
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
  button: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, ...cardElevation },
  buttonText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 15 },
  secondaryButton: { minHeight: 48, width: '100%', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface },
  secondaryButtonText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 },
  dangerButton: { minHeight: 50, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#b91c1c' },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});
