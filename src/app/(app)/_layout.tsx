import { Drawer, DrawerToggleButton } from 'expo-router/drawer';
import { StyleSheet, Text } from 'react-native';

import AppDrawerContent from '@/components/AppDrawerContent';
import { colors, fonts } from '@/theme';

export default function AppLayout() {
  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        drawerPosition: 'left',
        drawerType: 'front',
        overlayColor: 'rgba(15, 23, 42, 0.48)',
        drawerStyle: styles.drawer,
        sceneStyle: styles.scene,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTintColor: colors.primary,
        headerLeft: () => <DrawerToggleButton tintColor={colors.primary} />,
        drawerActiveTintColor: '#ffffff',
        drawerInactiveTintColor: '#334155',
      }}>
      <Drawer.Screen
        name="home"
        options={{
          headerTitle: () => (
            <Text style={styles.headerTitle}>
              <Text style={styles.brandMark}>⌖ </Text>
              ASISTENCIA IX
            </Text>
          ),
          headerTitleAlign: 'center',
        }}
      />
      <Drawer.Screen name="editar-perfil" options={{ title: 'Editar Perfil' }} />
      <Drawer.Screen name="requests" options={{ title: 'Solicitudes' }} />
      <Drawer.Screen name="linked" options={{ title: 'Vinculaciones' }} />
      <Drawer.Screen name="qr" options={{ title: 'Mi Código QR' }} />
      <Drawer.Screen name="asistencias" options={{ title: 'Asistencias' }} />
      <Drawer.Screen name="scan" options={{ title: 'Escanear código QR', drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen
        name="asistencias-practicante/[id]"
        options={{ title: 'Asistencias del practicante', drawerItemStyle: { display: 'none' } }}
      />
    </Drawer>
  );
}

const styles = StyleSheet.create({
  drawer: { width: 310, backgroundColor: colors.surface },
  scene: { backgroundColor: colors.background },
  header: { backgroundColor: colors.background },
  headerTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: 16, letterSpacing: 1 },
  brandMark: { color: colors.primary, fontFamily: fonts.body, fontSize: 19 },
});
