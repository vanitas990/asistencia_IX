import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { ApiRequestError } from '@/services/auth-api';
import { linkByQr, markAttendance } from '@/services/attendance-api';

type ScanMode = 'attendance' | 'link';

export default function ScanScreen() {
  const { mode: rawMode } = useLocalSearchParams<{ mode?: string }>();
  const mode: ScanMode = rawMode === 'link' ? 'link' : 'attendance';
  const { apiFetch } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanLocked = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  async function handleBarcodeScanned(result: BarcodeScanningResult) {
    if (scanLocked.current || !result || result.type !== 'qr') return;
    scanLocked.current = true;
    setIsProcessing(true);
    setScanError(null);

    try {
      const qrData = typeof result.data === 'string' ? result.data.trim() : '';
      if (!qrData) {
        throw new Error('El código QR no contiene datos.');
      }

      if (mode === 'attendance') {
        const attendance = await markAttendance(apiFetch, qrData);
        if (!isMounted.current) return;
        Alert.alert(
          'Asistencia registrada',
          `Asistencia registrada: ${attendance.tipo === 'entrada' ? 'Entrada' : 'Salida'}`,
          [{ text: 'Aceptar', onPress: () => router.back() }],
        );
      } else {
        await linkByQr(apiFetch, qrData);
        if (!isMounted.current) return;
        Alert.alert(
          'Vinculación completada',
          'El alumno fue agregado a tus vinculaciones.',
          [{ text: 'Aceptar', onPress: () => router.back() }],
        );
      }
    } catch (error) {
      const isDuplicateAttendance = mode === 'attendance'
        && error instanceof ApiRequestError
        && error.code === 'already_marked'
        && error.timestamp;
      const localTime = isDuplicateAttendance
        ? new Date(error.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
        : null;
      const message = isDuplicateAttendance
        ? `Ya marcaste tu asistencia hoy a las ${localTime}`
        : error instanceof Error ? error.message : 'No se pudo procesar el código QR.';
      if (!isDuplicateAttendance) {
        console.error('No se pudo procesar el código QR escaneado.', error);
      }
      if (!isMounted.current) return;
      setScanError(message);
      Alert.alert(
        isDuplicateAttendance ? 'Asistencia ya registrada' : 'Error',
        isDuplicateAttendance ? message : 'No se pudo procesar el código QR',
      );
    } finally {
      if (isMounted.current) {
        setIsProcessing(false);
      }
    }
  }

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.message}>Comprobando permiso de cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.title}>Se necesita acceso a la cámara</Text>
        <Text style={styles.message}>Permite el acceso para escanear el código QR.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void requestPermission()}
          style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Permitir cámara</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={isProcessing ? undefined : (result) => void handleBarcodeScanned(result)}
      />
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹  Volver</Text>
        </Pressable>
        <View style={styles.instructions}>
          <Text style={styles.title}>
            {mode === 'attendance' ? 'Marcar asistencia' : 'Agregar alumno'}
          </Text>
          <Text style={styles.message}>Coloca el código QR dentro del recuadro.</Text>
        </View>
        <View style={styles.scanFrame} />
        {isProcessing ? (
          <View style={styles.status}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.statusText}>Procesando código...</Text>
          </View>
        ) : scanError ? (
          <View style={styles.errorCard}>
            <Text accessibilityRole="alert" style={styles.errorText}>{scanError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setScanError(null);
                scanLocked.current = false;
              }}
              style={styles.retryButton}>
              <Text style={styles.retryText}>Intentar de nuevo</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.bottomHint}>El escáner leerá un solo código a la vez.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, backgroundColor: '#f1f5f9' },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  message: { color: '#e2e8f0', fontSize: 15, textAlign: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 24, paddingTop: 58, paddingBottom: 50, backgroundColor: '#0f172a66' },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  backText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
  instructions: { alignItems: 'center', gap: 8 },
  scanFrame: { width: 260, height: 260, borderWidth: 3, borderColor: '#ffffff', borderRadius: 24, backgroundColor: 'transparent' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { color: '#ffffff', fontSize: 15 },
  bottomHint: { color: '#ffffff', fontSize: 13, textAlign: 'center' },
  errorCard: { width: '100%', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14, backgroundColor: '#ffffff' },
  errorText: { color: '#b91c1c', fontSize: 14, textAlign: 'center' },
  retryButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 10, backgroundColor: '#dbeafe' },
  retryText: { color: '#1e3a8a', fontWeight: '700' },
  primaryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#2563eb' },
  primaryButtonText: { color: '#ffffff', fontWeight: '700' },
  cancelButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  cancelButtonText: { color: '#334155', fontWeight: '600' },
});
