import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ProfileAvatar from '@/components/ProfileAvatar';
import { useAuth } from '@/context/AuthContext';
import { cardElevation, colors, fonts } from '@/theme';
import {
  acceptLink,
  getActiveLinks,
  getPendingRequests,
  requestLink,
  type LinkedProfile,
  type PendingRequest,
  unlinkProfile,
} from '@/services/link-api';

function getMessage(error: unknown) {
  if (!(error instanceof Error)) return 'No se pudo completar la solicitud. Inténtalo de nuevo.';
  if (/error interno|internal server error|http 5\d\d/i.test(error.message)) {
    return 'No se pudo completar la solicitud. Revisa tu conexión a internet e inténtalo de nuevo.';
  }
  return error.message;
}

export default function HomeScreen() {
  const { user, isLoading, apiFetch, updateAvatar } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [dniAlumno, setDniAlumno] = useState('');
  const [activeLinks, setActiveLinks] = useState<LinkedProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const userRole = user?.rol;
  const { width: windowWidth } = useWindowDimensions();
  const isNarrowScreen = windowWidth < 390;

  useEffect(() => {
    if (!isLoading && !userRole) {
      router.replace('/');
    }
  }, [isLoading, userRole]);

  const loadHomeData = useCallback(async () => {
    if (!userRole) return;
    try {
      const [links, requests] = await Promise.all([
        getActiveLinks(apiFetch),
        userRole === 'alumno' ? getPendingRequests(apiFetch) : Promise.resolve([]),
      ]);
      setActiveLinks(links);
      setPendingRequests(requests);
    } catch (loadError) {
      console.error('No se pudieron cargar las vinculaciones del inicio.', loadError);
      setError(getMessage(loadError));
    } finally {
      setIsLoadingData(false);
    }
  }, [apiFetch, userRole]);

  async function handlePickAvatar() {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (result.canceled) return;

      const selectedImage = result.assets[0];
      if (!selectedImage.base64) {
        throw new Error('No se pudo leer la imagen seleccionada. Intenta con otra foto.');
      }

      const base64Padding = selectedImage.base64.endsWith('==')
        ? 2
        : selectedImage.base64.endsWith('=') ? 1 : 0;
      const imageSizeBytes = Math.floor(selectedImage.base64.length * 3 / 4) - base64Padding;
      if (imageSizeBytes > 1_048_576) {
        throw new Error('La imagen comprimida supera 1 MB. Selecciona una foto más pequeña.');
      }

      setIsUploadingAvatar(true);
      await updateAvatar(`data:image/jpeg;base64,${selectedImage.base64}`);
      setNotice('Foto de perfil actualizada.');
    } catch (pickerError) {
      console.error('No se pudo seleccionar o guardar la foto de perfil.', pickerError);
      setError(getMessage(pickerError));
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleCopyCode() {
    if (!user) return;
    try {
      await Clipboard.setStringAsync(user.dni);
      setCopyStatus('copied');
    } catch (copyError) {
      console.error('No se pudo copiar el código del perfil.', copyError);
      setCopyStatus('failed');
    }
  }

  useEffect(() => {
    if (!userRole) return;
    // State updates happen only after the asynchronous API request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHomeData();
  }, [loadHomeData, userRole]);

  async function handleAddPractitioner() {
    if (!/^\d{8}$/.test(dniAlumno)) {
      setError('Ingresa el DNI del alumno (8 dígitos).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await requestLink(apiFetch, dniAlumno);
      setDniAlumno('');
      setNotice('Solicitud enviada. El alumno debe aceptarla desde su cuenta.');
      await loadHomeData();
    } catch (requestError) {
      console.error('No se pudo enviar la solicitud de vinculación.', requestError);
      setError(getMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAccept(requestId: number) {
    setIsSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await acceptLink(apiFetch, requestId);
      setNotice('Vinculación aceptada.');
      await loadHomeData();
    } catch (acceptError) {
      console.error('No se pudo aceptar la solicitud de vinculación.', acceptError);
      setError(getMessage(acceptError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function confirmUnlink(profile: LinkedProfile) {
    Alert.alert(
      'Desvincular persona',
      `¿Quieres desvincular a ${profile.nombre}?`,
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
    setError(null);
    setNotice(null);
    try {
      await unlinkProfile(apiFetch, profile.vinculacion_id);
      setNotice('La vinculación fue eliminada.');
      await loadHomeData();
    } catch (unlinkError) {
      console.error('No se pudo eliminar la vinculación desde el inicio.', unlinkError);
      setError(getMessage(unlinkError));
    } finally {
      setUnlinkingId(null);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loading}>
        <Text style={styles.helpText}>Cerrando sesión…</Text>
      </View>
    );
  }

  const isSupervisor = user.rol === 'supervisor';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.welcomeCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambiar foto de perfil"
            disabled={isUploadingAvatar}
            onPress={() => void handlePickAvatar()}
            style={({ pressed }) => [styles.avatarPressable, pressed && styles.pressed]}>
            <ProfileAvatar
              avatarUrl={user.avatar_url}
              name={user.nombre}
              size={64}
              style={styles.welcomeAvatar}
            />
            <View style={styles.cameraBadge}>
              {isUploadingAvatar
                ? <ActivityIndicator color="#ffffff" size="small" />
                : <Text style={styles.cameraIcon}>✎</Text>}
            </View>
          </Pressable>
          <View style={styles.welcomeCopy}>
            <Text style={styles.welcomeName} numberOfLines={1}>{user.nombre}</Text>
            <Text style={styles.welcomeRole}>{isSupervisor ? 'Supervisor' : 'Alumno'}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copiar DNI ${user.dni}`}
              onPress={() => void handleCopyCode()}
              style={({ pressed }) => [styles.codeCopy, pressed && styles.pressed]}>
              <Text style={styles.codeCopyIcon}>▢</Text>
              <Text style={styles.codeCopyText}>DNI: {user.dni}</Text>
              <Text style={styles.copyFeedback}>
                {copyStatus === 'copied' ? 'Copiado' : copyStatus === 'failed' ? 'Error' : ''}
              </Text>
            </Pressable>
          </View>
        </View>

        {(error || notice) && (
          <View style={[styles.statusBanner, error ? styles.errorBanner : styles.noticeBanner]}>
            <Text style={[styles.statusIcon, error && styles.errorStatusText]}>{error ? '!' : '✓'}</Text>
            <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.statusText, error && styles.errorStatusText]}>
              {error ?? notice}
            </Text>
          </View>
        )}

        {isSupervisor ? (
          <View style={[styles.actionGrid, isNarrowScreen && styles.actionGridNarrow]}>
            <View style={[styles.card, styles.gridCard, isNarrowScreen && styles.gridCardNarrow]}>
              <Text style={styles.sectionTitle}>Añadir alumno</Text>
              <Text style={styles.helpText}>Ingresa el DNI de 8 dígitos del alumno.</Text>
              <TextInput
                accessibilityLabel="DNI de 8 dígitos del alumno"
                keyboardType="number-pad"
                maxLength={8}
                onChangeText={(value) => setDniAlumno(value.replace(/\D/g, ''))}
                placeholder="DNI del alumno"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={dniAlumno}
              />
              <ActionButton
                disabled={isSubmitting}
                label="Enviar solicitud"
                onPress={() => void handleAddPractitioner()}
                icon="＋"
              />
            </View>

            <View style={[styles.card, styles.gridCard, isNarrowScreen && styles.gridCardNarrow]}>
              <Text style={styles.sectionTitle}>Mi Código QR</Text>
              <Text style={styles.helpText}>Muestra el QR para que tus alumnos marquen asistencia.</Text>
              <ActionButton
                disabled={false}
                label="Ver mi QR"
                onPress={() => router.push('/(app)/qr')}
                secondary
                icon="▦"
              />
            </View>
            <View style={[styles.card, styles.gridCard, isNarrowScreen && styles.gridCardNarrow]}>
              <Text style={styles.sectionTitle}>Agregar por QR</Text>
              <Text style={styles.helpText}>Escanea el código QR de un alumno para vincularlo directamente.</Text>
              <ActionButton
                disabled={false}
                label="Escanear QR de alumno"
                onPress={() => router.push({ pathname: '/(app)/scan', params: { mode: 'link' } })}
                icon="⌗"
              />
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Solicitudes pendientes</Text>
            {isLoadingData ? (
              <ActivityIndicator color={colors.primary} />
            ) : pendingRequests.length ? (
              pendingRequests.slice(0, 3).map((request) => (
                <View key={request.id} style={styles.listItem}>
                  <View style={styles.listText}>
                    <Text style={styles.listTitle}>
                      {request.supervisor_nombre}
                    </Text>
                    <Text style={styles.listSubtitle}>{request.supervisor_facultad}</Text>
                  </View>
                  <ActionButton
                    disabled={isSubmitting}
                    label="Aceptar"
                    onPress={() => void handleAccept(request.id)}
                    compact
                  />
                </View>
              ))
            ) : (
              <Text style={styles.helpText}>No tienes solicitudes pendientes.</Text>
            )}
            <ActionButton
              disabled={false}
              label="Ver todas las solicitudes"
              onPress={() => router.push('/(app)/requests')}
              secondary
            />
            <View style={styles.quickActions}>
              <ActionButton
                disabled={false}
                label="Mi Código QR"
                onPress={() => router.push('/(app)/qr')}
                secondary
                icon="▦"
              />
              <ActionButton
                disabled={false}
                label="Escanear QR del Salón"
                onPress={() => router.push({ pathname: '/(app)/scan', params: { mode: 'attendance' } })}
                icon="⌗"
              />
            </View>
          </View>
        )}

        <View style={styles.optionsSection}>
          <Text style={styles.optionsTitle}>Accesos rápidos</Text>
          <View style={styles.optionsRow}>
            <QuickOption
              icon="◉"
              label="Editar Perfil"
              onPress={() => router.push('/(app)/editar-perfil')}
            />
            {isSupervisor ? (
              <>
                <QuickOption
                  icon="◷"
                  label="Asistencias"
                  onPress={() => router.push('/(app)/asistencias')}
                />
                <QuickOption
                  icon="⇄"
                  label="Mis alumnos"
                  onPress={() => router.push('/(app)/linked')}
                />
              </>
            ) : (
              <>
                <QuickOption
                  icon="◷"
                  label="Solicitudes"
                  onPress={() => router.push('/(app)/requests')}
                />
                <QuickOption
                  icon="⇄"
                  label="Supervisores"
                  onPress={() => router.push('/(app)/linked')}
                />
              </>
            )}
          </View>
        </View>

        {!isSupervisor && (
          <View style={styles.card}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>Supervisores vinculados</Text>
              <Text style={styles.countBadge}>{activeLinks.length}</Text>
            </View>
            {isLoadingData ? (
              <ActivityIndicator color={colors.primary} />
            ) : activeLinks.length ? (
              activeLinks.slice(0, 4).map((profile) => (
                <View key={profile.vinculacion_id} style={styles.listItem}>
                  <View style={styles.personAvatar}>
                    <Text style={styles.personInitial}>{profile.nombre.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.listText}>
                    <Text style={styles.listTitle}>{profile.nombre}</Text>
                    <Text style={styles.listSubtitle}>
                      {profile.dni}{profile.facultad ? ` · ${profile.facultad}` : ''}
                    </Text>
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
                      <Text style={styles.unlinkIcon}>🗑</Text>
                    )}
                  </Pressable>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>⇄</Text>
                <Text style={styles.helpText}>Todavía no tienes vinculaciones activas.</Text>
              </View>
            )}
            <ActionButton
              disabled={false}
              label="Ver supervisores vinculados"
              onPress={() => router.push('/(app)/linked')}
              secondary
            />
          </View>
        )}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  disabled,
  label,
  onPress,
  secondary = false,
  compact = false,
  icon,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  secondary?: boolean;
  compact?: boolean;
  icon?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        compact && styles.compactButton,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {icon && <Text style={[styles.buttonIcon, secondary && styles.secondaryButtonText]}>{icon}</Text>}
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

function QuickOption({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickOption, pressed && styles.pressed]}>
      <Text style={styles.quickOptionIcon}>{icon}</Text>
      <Text numberOfLines={2} style={styles.quickOptionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 20, paddingBottom: 28, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 900, alignSelf: 'center', gap: 14 },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.earth,
    borderRadius: 16,
    backgroundColor: colors.primary,
    ...cardElevation,
  },
  avatarPressable: { position: 'relative' },
  welcomeAvatar: { borderWidth: 2, borderColor: '#ffffff' },
  cameraBadge: {
    position: 'absolute',
    right: -3,
    bottom: -2,
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  cameraIcon: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  welcomeCopy: { flex: 1, minWidth: 0, gap: 4 },
  welcomeName: { color: '#ffffff', fontFamily: fonts.display, fontSize: 18 },
  welcomeRole: { color: '#e5e2dc', fontFamily: fonts.body, fontSize: 13 },
  codeCopy: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 3 },
  codeCopyIcon: { color: '#bfdbfe', fontSize: 15, fontWeight: '800' },
  codeCopyText: { color: '#ffffff', fontFamily: fonts.medium, fontSize: 12 },
  copyFeedback: { color: '#d2e4d5', fontFamily: fonts.medium, fontSize: 11 },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12 },
  noticeBanner: { backgroundColor: colors.successBackground },
  errorBanner: { backgroundColor: colors.dangerBackground },
  statusIcon: { color: colors.success, fontSize: 15, fontWeight: '900' },
  statusText: { flex: 1, color: colors.success, fontFamily: fonts.medium, fontSize: 13 },
  errorStatusText: { color: colors.danger },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  actionGridNarrow: { flexDirection: 'column' },
  gridCard: { width: '48%', minHeight: 190, justifyContent: 'space-between', borderRadius: 16 },
  gridCardNarrow: { width: '100%', minHeight: 0 },
  card: {
    gap: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...cardElevation,
  },
  sectionTitle: { flex: 1, color: colors.text, fontFamily: fonts.display, fontSize: 17 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countBadge: { minWidth: 28, overflow: 'hidden', borderRadius: 14, backgroundColor: colors.earthLight, color: colors.primary, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 13, paddingHorizontal: 7, paddingVertical: 4 },
  helpText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  optionsSection: { gap: 10 },
  optionsTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 18 },
  optionsRow: { flexDirection: 'row', gap: 10 },
  quickOption: { flex: 1, minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, ...cardElevation },
  quickOptionIcon: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  quickOptionLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: 11, textAlign: 'center' },
  input: { minHeight: 50, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surfaceMuted, fontFamily: fonts.body, fontSize: 16 },
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, backgroundColor: colors.primary, paddingHorizontal: 12, ...cardElevation },
  buttonText: { color: '#ffffff', fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center' },
  buttonIcon: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  secondaryButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.primary },
  compactButton: { minHeight: 40, paddingHorizontal: 13 },
  quickActions: { flexDirection: 'row', gap: 10 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, ...cardElevation },
  personAvatar: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.earthLight },
  personInitial: { color: colors.primary, fontFamily: fonts.display, fontSize: 17 },
  listText: { flex: 1, gap: 3 },
  listTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 14 },
  listSubtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  emptyState: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  emptyIcon: { color: '#94a3b8', fontSize: 25 },
  unlinkButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.earthLight },
  unlinkIcon: { color: colors.earth, fontSize: 17 },
  pressed: { opacity: 0.84 },
  disabled: { opacity: 0.55 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
