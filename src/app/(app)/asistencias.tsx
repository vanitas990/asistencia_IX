import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { getAttendanceHistory, type AttendanceRecord } from '@/services/attendance-api';
import { cardElevation, colors, fonts } from '@/theme';
import { formatLocalTimestamp } from '@/utils/date';

export default function AttendancesScreen() {
  const { apiFetch, user, isLoading: isAuthLoading } = useAuth();
  const userRole = user?.rol;
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isRequestInFlight = useRef(false);
  const hasLoadedAttendance = useRef(false);
  const latestAttendanceId = useRef<number | null>(null);

  const loadAttendance = useCallback(async (showLoading: boolean) => {
    if (!userRole || isRequestInFlight.current) return;
    isRequestInFlight.current = true;
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const result = await getAttendanceHistory(apiFetch);
      const newestId = result.data[0]?.id ?? null;
      if (
        userRole === 'supervisor'
        && hasLoadedAttendance.current
        && newestId !== null
        && (latestAttendanceId.current === null || newestId > latestAttendanceId.current)
      ) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((hapticError: unknown) => {
          console.warn('No se pudo reproducir la vibración de nueva asistencia.', hapticError);
        });
      }
      if (newestId !== null && (latestAttendanceId.current === null || newestId > latestAttendanceId.current)) {
        latestAttendanceId.current = newestId;
      }
      hasLoadedAttendance.current = true;
      setRecords(result.data);
    } catch (loadError) {
      console.error('No se pudo cargar el historial de asistencias.', loadError);
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el historial.');
    } finally {
      isRequestInFlight.current = false;
      setIsLoading(false);
    }
  }, [apiFetch, userRole]);

  useEffect(() => {
    if (!userRole) return;
    // State updates happen only after the asynchronous API request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAttendance(true);
  }, [isAuthLoading, loadAttendance, userRole]);

  useEffect(() => {
    if (userRole !== 'supervisor') return;
    const interval = setInterval(() => {
      void loadAttendance(false);
    }, 15_000);
    return () => clearInterval(interval);
  }, [loadAttendance, userRole]);

  const isSupervisor = userRole === 'supervisor';

  if (!userRole && !isAuthLoading) {
    return (
      <View style={[styles.container, styles.emptyState]}>
        <Text style={styles.empty}>Inicia sesión para consultar las asistencias.</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={records}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => void loadAttendance(true)}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={(
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>ASISTENCIA IX</Text>
          <Text style={styles.title}>{isSupervisor ? 'Asistencias de alumnos' : 'Mis asistencias'}</Text>
          <Text style={styles.subtitle}>
            {isSupervisor ? 'Actualización automática cada 15 segundos.' : 'Tu historial de entradas y salidas.'}
          </Text>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
        </View>
      )}
      renderItem={({ item }) => {
        const person = isSupervisor ? item.alumno_nombre : item.supervisor_nombre;
        return (
          <View style={styles.recordCard}>
            <View style={styles.recordDetails}>
              <Text style={styles.personName}>{isSupervisor ? person || 'Alumno' : person || 'Supervisor'}</Text>
              <Text style={styles.date}>{formatLocalTimestamp(item.timestamp)}</Text>
            </View>
            <View style={[styles.typeBadge, item.tipo === 'entrada' ? styles.entryBadge : styles.exitBadge]}>
              <Text style={[styles.typeText, item.tipo === 'entrada' ? styles.entryText : styles.exitText]}>
                {item.tipo === 'entrada' ? 'Entrada' : 'Salida'}
              </Text>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={!isLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>◷</Text>
          <Text style={styles.empty}>Aún no hay registros de asistencia.</Text>
        </View>
      ) : undefined}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, gap: 12, backgroundColor: colors.background },
  headerCard: {
    gap: 8,
    padding: 20,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    ...cardElevation,
  },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  loader: { marginTop: 8 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  recordCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, ...cardElevation },
  recordDetails: { flex: 1, gap: 5 },
  personName: { color: colors.text, fontFamily: fonts.display, fontSize: 15 },
  date: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  typeBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12 },
  entryBadge: { backgroundColor: colors.successBackground },
  exitBadge: { backgroundColor: colors.earthLight },
  typeText: { fontFamily: fonts.semibold, fontSize: 12 },
  entryText: { color: colors.success },
  exitText: { color: colors.earth },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyIcon: { color: '#94a3b8', fontSize: 32 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
});
