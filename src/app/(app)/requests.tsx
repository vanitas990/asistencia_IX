import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { acceptLink, getPendingRequests, type PendingRequest } from '@/services/link-api';
import { cardElevation, colors, fonts } from '@/theme';

export default function RequestsScreen() {
  const { apiFetch } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await getPendingRequests(apiFetch));
    } catch (loadError) {
      console.error('No se pudieron cargar las solicitudes pendientes.', loadError);
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las solicitudes.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    // State updates happen only after the asynchronous API request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRequests();
  }, [loadRequests]);

  async function handleAccept(requestId: number) {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await acceptLink(apiFetch, requestId);
      await loadRequests();
      setNotice('Vinculación aceptada.');
    } catch (acceptError) {
      console.error('No se pudo aceptar la solicitud.', acceptError);
      setError(acceptError instanceof Error ? acceptError.message : 'No se pudo aceptar la solicitud.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>VINCULACIONES</Text>
        <Text style={styles.title}>Solicitudes pendientes</Text>
        <Text style={styles.subtitle}>Revisa las solicitudes de tus supervisores.</Text>

        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : requests.length ? (
          requests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <View style={styles.requestDetails}>
                <Text style={styles.requestName}>
                  {request.supervisor_nombre} {request.supervisor_apellido}
                </Text>
                <Text style={styles.requestMeta}>{request.supervisor_facultad}</Text>
                {request.created_at && (
                  <Text style={styles.requestMeta}>
                    Solicitud recibida {new Date(request.created_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => void handleAccept(request.id)}
                style={({ pressed }) => [styles.button, pressed && styles.pressed, isSubmitting && styles.disabled]}>
                <Text style={styles.buttonText}>Aceptar</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No tienes solicitudes pendientes.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: colors.background },
  card: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    ...cardElevation,
  },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 14 },
  notice: { color: colors.success, fontFamily: fonts.body, fontSize: 14 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...cardElevation,
  },
  requestDetails: { flex: 1, gap: 4 },
  requestName: { color: colors.text, fontFamily: fonts.display, fontSize: 16 },
  requestMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  button: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.primary, ...cardElevation },
  buttonText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 14 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, paddingVertical: 12 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.55 },
});
