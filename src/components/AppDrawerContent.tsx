import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import {
  DrawerContentScrollView,
  DrawerItem,
  type DrawerContentComponentProps,
} from 'expo-router/drawer';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import ProfileAvatar from '@/components/ProfileAvatar';
import { useAuth } from '@/context/AuthContext';
import { colors, fonts } from '@/theme';

interface MenuItem {
  name: 'home' | 'editar-perfil' | 'requests' | 'linked' | 'qr' | 'asistencias';
  label: string;
  icon: string;
}

export default function AppDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const isSupervisor = user?.rol === 'supervisor';
  const menuItems: MenuItem[] = [
    { name: 'home', label: 'Perfil', icon: '◉' },
    { name: 'editar-perfil', label: 'Editar Perfil', icon: '✎' },
    ...(isSupervisor
      ? [
          { name: 'linked' as const, label: 'Mis Alumnos', icon: '⇄' },
          { name: 'qr' as const, label: 'Mi Código QR', icon: '▦' },
          { name: 'asistencias' as const, label: 'Asistencias', icon: '◷' },
        ]
      : [
          { name: 'requests' as const, label: 'Solicitudes', icon: '◷' },
          { name: 'linked' as const, label: 'Supervisores vinculados', icon: '⇄' },
          { name: 'qr' as const, label: 'Mi Código QR', icon: '▦' },
          { name: 'asistencias' as const, label: 'Mis Asistencias', icon: '▤' },
        ]),
  ];
  const activeRoute = props.state.routes[props.state.index]?.name;

  async function handleCopyId() {
    if (!user) return;
    try {
      await Clipboard.setStringAsync(user.dni);
      setCopyStatus('copied');
    } catch (copyError) {
      console.error('No se pudo copiar el código de usuario.', copyError);
      setCopyStatus('failed');
    }
  }

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);
    try {
      await logout();
      router.replace('/');
    } catch (logoutError) {
      console.error('No se pudo cerrar la sesión desde el menú.', logoutError);
      setError(logoutError instanceof Error ? logoutError.message : 'No se pudo cerrar la sesión.');
      setIsSigningOut(false);
    }
  }

  return (
    <View style={styles.container}>
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        style={styles.scroll}>
        <View style={styles.profileHeader}>
          <ProfileAvatar
            avatarUrl={user?.avatar_url ?? null}
            name={user?.nombre ?? 'Usuario'}
            size={64}
            style={styles.avatar}
          />
          <Text numberOfLines={1} style={styles.userName}>
            {user?.nombre ?? 'Mi perfil'}
          </Text>
          <Text style={styles.userRole}>
            {isSupervisor ? 'Supervisor' : 'Alumno'}
          </Text>
          {user && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copiar DNI ${user.dni}`}
              onPress={() => void handleCopyId()}
              style={({ pressed }) => [styles.copyId, pressed && styles.copyIdPressed]}>
              <Text style={styles.userId}>DNI: {user.dni}</Text>
              <Text style={styles.copyHint}>
                {copyStatus === 'copied'
                  ? 'ID copiado'
                  : copyStatus === 'failed' ? 'No se pudo copiar' : 'Toca para copiar'}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.menu}>
          {menuItems.map((item) => (
            <DrawerItem
              key={item.name}
              focused={activeRoute === item.name}
              label={item.label}
              icon={({ color }) => <Text style={[styles.menuIcon, { color }]}>{item.icon}</Text>}
              activeTintColor="#ffffff"
              inactiveTintColor="#334155"
              activeBackgroundColor={colors.primary}
              onPress={() => props.navigation.navigate(item.name)}
              style={styles.menuItem}
              labelStyle={styles.menuLabel}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/politicas')}
            style={({ pressed }) => [styles.policyItem, pressed && styles.policyItemPressed]}>
            <Text style={styles.policyIcon}>▤</Text>
            <Text style={styles.policyLabel}>Políticas de Privacidad</Text>
          </Pressable>
        </View>
      </DrawerContentScrollView>

      <View style={styles.footer}>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={isSigningOut}
          onPress={() => void handleSignOut()}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed, isSigningOut && styles.disabled]}>
          {isSigningOut ? (
            <ActivityIndicator color="#b91c1c" size="small" />
          ) : (
            <>
              <Text style={styles.logoutIcon}>↪</Text>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 0 },
  profileHeader: {
    alignItems: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 26,
  },
  avatar: { marginBottom: 14 },
  userName: { maxWidth: '100%', color: '#ffffff', fontFamily: fonts.display, fontSize: 19 },
  userRole: { color: '#e5e2dc', fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  copyId: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, paddingVertical: 4 },
  copyIdPressed: { opacity: 0.75 },
  userId: { color: '#ffffff', fontFamily: fonts.semibold, fontSize: 13 },
  copyHint: { color: '#e5e2dc', fontFamily: fonts.body, fontSize: 11 },
  menu: { paddingHorizontal: 12, paddingTop: 16 },
  menuItem: { borderRadius: 12, marginVertical: 3 },
  menuLabel: { fontFamily: fonts.medium, fontSize: 14, marginLeft: -14 },
  menuIcon: { width: 22, fontSize: 18, textAlign: 'center' },
  policyItem: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 18, marginVertical: 3, paddingHorizontal: 16, borderRadius: 12 },
  policyItemPressed: { backgroundColor: '#f1f0ec' },
  policyIcon: { width: 22, color: colors.primary, fontSize: 18, textAlign: 'center' },
  policyLabel: { color: '#334155', fontFamily: fonts.medium, fontSize: 14 },
  footer: { borderTopWidth: 1, borderTopColor: '#e2e8f0', padding: 16 },
  logout: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  logoutIcon: { color: '#b91c1c', fontSize: 20 },
  logoutText: { color: '#b91c1c', fontSize: 15, fontWeight: '700' },
  error: { color: '#b91c1c', fontSize: 12, marginBottom: 8 },
  pressed: { backgroundColor: '#f1f5f9' },
  disabled: { opacity: 0.6 },
});
