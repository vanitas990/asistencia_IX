import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { getActiveLinks, type LinkedProfile, unlinkProfile } from '@/services/link-api';
import { cardElevation, colors, fonts } from '@/theme';

export default function LinkedScreen() {
  const { apiFetch, user } = useAuth();
  const [profiles, setProfiles] = useState<LinkedProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      setProfiles(await getActiveLinks(apiFetch));
      setLoadError(null);
    } catch (loadError) {
      console.error('No se pudieron cargar las vinculaciones activas.', loadError);
      setLoadError('No se pudieron cargar las vinculaciones. Intenta de nuevo más tarde.');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    // State updates happen only after the asynchronous API request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfiles();
  }, [loadProfiles]);

  const isSupervisor = user?.rol === 'supervisor';
  const isAlumno = user?.rol === 'alumno';

  function confirmUnlink(profile: LinkedProfile) {
    const name = profile.nombre;
    Alert.alert(
      'Desvincular persona',
      `¿Quieres desvincular a ${name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: () => void handleUnlink(profile),
        },
      ],
    );
  }

  async function handleUnlink(profile: LinkedProfile) {
    setUnlinkingId(profile.vinculacion_id);
    setNotice(null);
    try {
      await unlinkProfile(apiFetch, profile.vinculacion_id);
      await loadProfiles();
      setNotice('La vinculación fue eliminada.');
    } catch (unlinkError) {
      console.error('No se pudo eliminar la vinculación.', unlinkError);
    } finally {
      setUnlinkingId(null);
    }
  }

  async function openContactUrl(url: string, action: string) {
    try {
      await Linking.openURL(url);
    } catch (contactError) {
      console.error(`No se pudo abrir ${action}.`, contactError);
      Alert.alert('No se pudo abrir el contacto', `Revisa que tengas una aplicación compatible con ${action}.`);
    }
  }

  async function openWhatsApp(telefono: string) {
    const digits = telefono.replace(/\D/g, '');
    const nationalNumber = digits.startsWith('51') ? digits.slice(2) : digits;
    const internationalNumber = `51${nationalNumber}`;
    const url = Platform.OS === 'web'
      ? `https://web.whatsapp.com/send?phone=${internationalNumber}`
      : `whatsapp://send?phone=${internationalNumber}`;
    await openContactUrl(url, 'WhatsApp');
  }

  function getContactEmail(profile: LinkedProfile) {
    if (isAlumno) {
      return profile.correo_personal;
    }
    const preferredEmail = profile.correo_preferido === 'personal'
      ? profile.correo_personal
      : profile.correo_institucional;
    return preferredEmail;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.card, Platform.OS === 'web' && styles.webCard]}>
        <Text style={styles.eyebrow}>VINCULACIONES</Text>
        <Text style={styles.title}>
          {isSupervisor ? 'Mis Alumnos' : 'Supervisores vinculados'}
        </Text>
        <Text style={styles.subtitle}>Personas vinculadas activamente a tu cuenta.</Text>

        {notice && <Text style={styles.notice}>{notice}</Text>}
        {isLoading ? (
          <ActivityIndicator color={colors.text} />
        ) : loadError ? (
          <Text accessibilityRole="alert" style={styles.loadError}>{loadError}</Text>
        ) : profiles.length ? (
          profiles.map((profile) => (
            <View key={profile.vinculacion_id} style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile.nombre.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.details}>
                <Text style={styles.name}>{profile.nombre}</Text>
                <Text style={styles.meta}>DNI {profile.dni}</Text>
                <Text style={styles.meta}>
                  {isAlumno ? `Especialidad / Área: ${profile.carrera}` : profile.carrera}
                </Text>
                {profile.facultad && <Text style={styles.meta}>{profile.facultad}</Text>}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Desvincular a ${profile.nombre}`}
                disabled={unlinkingId !== null}
                onPress={() => confirmUnlink(profile)}
                style={({ pressed }) => [styles.unlinkButton, pressed && styles.pressed, unlinkingId !== null && styles.disabled]}>
                {unlinkingId === profile.vinculacion_id ? (
                  <ActivityIndicator color="#b91c1c" size="small" />
                ) : (
                  <>
                    <Text style={styles.unlinkIcon}>🗑</Text>
                    <Text style={styles.unlinkText}>Desvincular</Text>
                  </>
                )}
              </Pressable>
              {isSupervisor && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ver asistencias de ${profile.nombre}`}
                  onPress={() => router.push({
                    pathname: '/(app)/asistencias-alumno/[id]',
                    params: { id: String(profile.id), nombre: profile.nombre },
                  })}
                  style={({ pressed }) => [styles.attendanceButton, pressed && styles.pressed]}>
                  <Text style={styles.attendanceButtonText}>Ver Asistencias</Text>
                </Pressable>
              )}
              {(profile.telefono || getContactEmail(profile)) && (
                <View style={styles.contactActions}>
                  {profile.telefono && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir WhatsApp para ${profile.nombre}`}
                      onPress={() => void openWhatsApp(profile.telefono ?? '')}
                      style={({ pressed }) => [styles.contactButton, styles.whatsappButton, pressed && styles.pressed]}>
                      <Text style={styles.contactIcon}>WA</Text>
                    </Pressable>
                  )}
                  {getContactEmail(profile) && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Enviar correo a ${profile.nombre}`}
                      onPress={() => void openContactUrl(`mailto:${encodeURIComponent(getContactEmail(profile) ?? '')}`, 'el correo')}
                      style={({ pressed }) => [styles.contactButton, styles.emailButton, pressed && styles.pressed]}>
                      <Text style={styles.emailIcon}>✉</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>⇄</Text>
            <Text style={styles.empty}>Aún no tienes vinculaciones activas.</Text>
          </View>
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
  webCard: { width: '90%', maxWidth: 1200 },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14 },
  notice: { color: colors.success, fontFamily: fonts.body, fontSize: 14 },
  loadError: { color: colors.danger, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  profileCard: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, ...cardElevation },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: colors.earthLight },
  avatarText: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  details: { flex: 1, gap: 3 },
  name: { color: colors.text, fontFamily: fonts.display, fontSize: 16 },
  contactActions: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 4 },
  contactButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  whatsappButton: { backgroundColor: 'rgba(37, 211, 102, 0.2)' },
  emailButton: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  contactIcon: { color: '#7CE9A4', fontFamily: fonts.bold, fontSize: 10 },
  emailIcon: { color: colors.text, fontSize: 15 },
  meta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  unlinkButton: { alignItems: 'center', gap: 3, padding: 10, borderRadius: 12, backgroundColor: colors.earthLight },
  unlinkIcon: { color: colors.earth, fontSize: 16 },
  unlinkText: { color: colors.earth, fontFamily: fonts.medium, fontSize: 11 },
  attendanceButton: { minHeight: 40, width: '100%', alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  attendanceButtonText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13 },
  emptyState: { alignItems: 'center', gap: 7, paddingVertical: 10 },
  emptyIcon: { color: '#E0E0E0', fontSize: 28 },
  empty: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textAlign: 'center' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.55 },
});
