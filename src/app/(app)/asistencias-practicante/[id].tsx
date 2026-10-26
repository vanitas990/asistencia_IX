import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { getAttendanceHistory, type AttendanceRecord } from '@/services/attendance-api';
import { formatLocalTimestamp } from '@/utils/date';
import { cardElevation, colors, fonts } from '@/theme';

export default function PractitionerAttendanceScreen() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();
  const practitionerId = Number(id);
  const { apiFetch, user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isValidPractitionerId = Number.isSafeInteger(practitionerId) && practitionerId > 0;

  const loadAttendance = useCallback(async () => {
    if (user?.rol !== 'supervisor' || !isValidPractitionerId) return;
    try {
      const result = await getAttendanceHistory(apiFetch, 50, practitionerId);
      setRecords(result.data);
      setError(null);
    } catch (loadError) {
      console.error('No se pudieron cargar las asistencias del practicante.', loadError);
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las asistencias.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, isValidPractitionerId, practitionerId, user?.rol]);

  useEffect(() => {
    // State updates happen after the API request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAttendance();
  }, [loadAttendance]);

  if (user?.rol !== 'supervisor' || !isValidPractitionerId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>
          {user?.rol !== 'supervisor'
            ? 'Esta pantalla solo está disponible para supervisores.'
            : 'El identificador del practicante no es válido.'}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={records}
      keyExtractor={(item) => String(item.id)}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={() => void loadAttendance()} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>HISTORIAL</Text>
          <Text style={styles.title} numberOfLines={2}>{nombre || 'Practicante'}</Text>
          <Text style={styles.subtitle}>Últimas 50 asistencias registradas.</Text>
          {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {isLoading && <ActivityIndicator color={colors.primary} style={styles.loader} />}
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.recordCard}>
          <View style={styles.recordDetails}>
            <Text style={styles.recordDate}>{formatLocalTimestamp(item.timestamp)}</Text>
            <Text style={styles.recordMeta}>Registro #{item.id}</Text>
          </View>
          <View style={[styles.typeBadge, item.tipo === 'entrada' ? styles.entryBadge : styles.exitBadge]}>
            <Text style={[styles.typeText, item.tipo === 'entrada' ? styles.entryText : styles.exitText]}>
              {item.tipo === 'entrada' ? 'Entrada' : 'Salida'}
            </Text>
          </View>
        </View>
      )}
      ListEmptyComponent={!isLoading && !error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>◷</Text>
          <Text style={styles.empty}>Este practicante aún no tiene asistencias registradas.</Text>
        </View>
      ) : undefined}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
    />
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, gap: 12, padding: 20, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  headerCard: { gap: 8, padding: 20, marginBottom: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, ...cardElevation },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 22 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  loader: { marginTop: 8 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  recordCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, ...cardElevation },
  recordDetails: { flex: 1, gap: 5 },
  recordDate: { color: colors.text, fontFamily: fonts.display, fontSize: 14 },
  recordMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  typeBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12 },
  entryBadge: { backgroundColor: colors.successBackground },
  exitBadge: { backgroundColor: colors.earthLight },
  typeText: { fontFamily: fonts.semibold, fontSize: 12 },
  entryText: { color: colors.success },
  exitText: { color: colors.earth },
  emptyState: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyIcon: { color: '#94a3b8', fontSize: 32 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
});
