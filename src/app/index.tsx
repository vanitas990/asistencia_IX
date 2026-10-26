import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';

export default function WelcomeScreen() {
  const { user, isLoading, authError, clearAuthError } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!isLoading && userId) {
      router.replace('/(app)/home');
    }
  }, [isLoading, userId]);

  if (isLoading || user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo / Marca */}
        <View style={styles.mark}>
          <Text style={styles.markText}>A</Text>
        </View>

        {/* Textos de bienvenida */}
        <Text style={styles.eyebrow}>ASISTENCIA IX</Text>
        <Text style={styles.title}>Tu asistencia,{"\n"}más simple.</Text>
        <Text style={styles.subtitle}>
          Registra y consulta tu asistencia de forma rápida y segura.
        </Text>

        {authError && (
          <Pressable onPress={clearAuthError}>
            <Text style={styles.error}>{authError}</Text>
          </Pressable>
        )}

        {/* Botones de acción sin conflictos de Link */}
        <View style={styles.buttonContainer}>
          <Pressable 
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
          </Pressable>

          <Pressable 
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.secondaryButtonText}>Crear cuenta</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 24, 
    backgroundColor: '#f8fafc' 
  },
  content: { 
    width: '100%', 
    maxWidth: 440, 
    alignSelf: 'center', 
    alignItems: 'center', 
  },
  mark: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    marginBottom: 16,
  },
  markText: { color: '#1d4ed8', fontSize: 36, fontWeight: '800' },
  eyebrow: { color: '#2563eb', fontSize: 12, fontWeight: '700', letterSpacing: 1.7, marginBottom: 8 },
  title: { color: '#0f172a', fontSize: 32, fontWeight: '800', textAlign: 'center', lineHeight: 38, marginBottom: 12 },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 32 },
  
  buttonContainer: {
    width: '100%',
    gap: 12,
  },

  /* Botón Principal: Azul / Slate Oscuro que sí o sí tiene que verse sólido */
  primaryButton: {
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#2563eb', // Fondo oscuro potente
  },
  primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  /* Botón Secundario: Fondo con borde bien marcado */
  secondaryButton: {
    height: 54,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  secondaryButtonText: { color: '#334155', fontSize: 16, fontWeight: '700' },

  pressed: { opacity: 0.8 },
  error: { color: '#b91c1c', textAlign: 'center', fontSize: 14, marginBottom: 16 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
});