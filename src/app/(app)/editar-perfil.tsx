import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/AuthContext';
import { cardElevation, colors, fonts } from '@/theme';

export default function EditProfileScreen() {
  const { user, updateProfile } = useAuth();
  const [nombre, setNombre] = useState(user?.nombre ?? '');
  const [apellido, setApellido] = useState(user?.apellido ?? '');
  const [facultad, setFacultad] = useState(user?.facultad ?? '');
  const [carrera, setCarrera] = useState(user?.carrera ?? '');
  const [ciclo, setCiclo] = useState(user?.ciclo ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const fields = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      facultad: facultad.trim(),
      carrera: carrera.trim(),
      ciclo: ciclo.trim(),
    };
    if (Object.values(fields).some((value) => !value)) {
      setError('Completa todos los campos antes de guardar.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateProfile(fields);
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.', [
        { text: 'Aceptar', onPress: () => router.back() },
      ]);
    } catch (saveError) {
      console.error('No se pudo actualizar el perfil.', saveError);
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el perfil.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.eyebrow}>MI CUENTA</Text>
            <Text style={styles.title}>Editar perfil</Text>
            <Text style={styles.subtitle}>Actualiza tus datos personales y académicos.</Text>

            <ProfileInput label="Nombre" value={nombre} onChangeText={setNombre} />
            <ProfileInput label="Apellido" value={apellido} onChangeText={setApellido} />
            <ProfileInput label="Facultad" value={facultad} onChangeText={setFacultad} />
            <ProfileInput label="Carrera" value={carrera} onChangeText={setCarrera} />
            <ProfileInput label="Ciclo" value={ciclo} onChangeText={setCiclo} />

            <View style={styles.readOnlyField}>
              <Text style={styles.label}>DNI (no editable)</Text>
              <Text selectable style={styles.readOnlyValue}>{user.dni}</Text>
            </View>
            <View style={styles.readOnlyField}>
              <Text style={styles.label}>Rol (no editable)</Text>
              <Text style={styles.readOnlyValue}>{user.rol === 'supervisor' ? 'Supervisor' : 'Alumno'}</Text>
            </View>

            {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void handleSave()}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, isSaving && styles.disabled]}>
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveText}>Guardar cambios</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ProfileInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        onChangeText={onChangeText}
        value={value}
        placeholder={label}
        placeholderTextColor="#94a3b8"
        style={styles.input}
        maxLength={label === 'Nombre' || label === 'Apellido' ? 100 : 150}
        returnKeyType="next"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 16, padding: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, ...cardElevation },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, marginBottom: 4 },
  inputGroup: { gap: 6 },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.surfaceMuted, fontFamily: fonts.body, fontSize: 15 },
  readOnlyField: { gap: 6, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  readOnlyValue: { color: colors.textMuted, fontFamily: fonts.semibold, fontSize: 15 },
  error: { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },
  saveButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, marginTop: 4, ...cardElevation },
  saveText: { color: colors.surface, fontFamily: fonts.semibold, fontSize: 15 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
});
