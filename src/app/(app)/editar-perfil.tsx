import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
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
  const [facultad, setFacultad] = useState(user?.facultad ?? '');
  const [carrera, setCarrera] = useState(user?.carrera ?? '');
  const [telefono, setTelefono] = useState(user?.telefono ?? '');
  const [correoInstitucional, setCorreoInstitucional] = useState(user?.correo_institucional ?? '');
  const [correoPersonal, setCorreoPersonal] = useState(user?.correo_personal ?? '');
  const [correoPreferido, setCorreoPreferido] = useState(user?.correo_preferido ?? 'institucional');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function showMessage(title: string, message: string) {
    if (Platform.OS === 'web') {
      globalThis.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  }

  function handleUpdatePassword() {
    if (!password) {
      showMessage('Contraseña requerida', 'Ingresa una nueva contraseña para continuar.');
      return;
    }

    // TODO: Conectar con endpoint de actualización de contraseña
    showMessage('Contraseña actualizada', 'La actualización de contraseña es una simulación.');
    setPassword('');
  }

  async function handleSave() {
    if (!user) return;
    const institutionalEmail = correoInstitucional.trim();
    const personalEmail = correoPersonal.trim();
    if (user.rol === 'alumno' && user.origen_datos === 'manual'
      && !institutionalEmail && !personalEmail) {
      showMessage('Correo requerido', 'Ingresa al menos un correo de contacto.');
      return;
    }
    const preferredEmail = correoPreferido === 'institucional'
      ? user.rol === 'alumno' && user.origen_datos === 'api'
        ? user.correo_institucional?.trim()
        : institutionalEmail
      : personalEmail;
    if (user.rol === 'alumno' && !preferredEmail) {
      showMessage('Preferencia de correo', 'Ingresa el correo que seleccionaste como preferido.');
      return;
    }

    const fields = user.rol === 'supervisor'
      ? {
          nombre: nombre.trim(),
          carrera: carrera.trim(),
          telefono: telefono.trim() || null,
          correo_personal: personalEmail || null,
        }
      : user.origen_datos === 'api'
        ? {
            telefono: telefono.trim() || null,
            correo_personal: personalEmail || null,
            correo_preferido: correoPreferido,
          }
        : {
            nombre: nombre.trim(),
            facultad: facultad.trim() || null,
            telefono: telefono.trim() || null,
            correo_institucional: institutionalEmail || null,
            correo_personal: personalEmail || null,
            correo_preferido: correoPreferido,
          };

    setIsSaving(true);
    try {
      await updateProfile(fields);
      showMessage('Perfil actualizado', 'Tus cambios se guardaron correctamente.');
    } catch (saveError) {
      console.error('No se pudo actualizar el perfil.', saveError);
      showMessage(
        'No se pudo actualizar',
        saveError instanceof Error ? saveError.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderEmailPreference() {
    return (
      <View style={styles.preferenceGroup}>
        <Text style={styles.label}>¿A qué correo deseas que te contacten?</Text>
        <View accessibilityRole="radiogroup" style={styles.preferenceOptions}>
          {(['institucional', 'personal'] as const).map((preference) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: correoPreferido === preference }}
              key={preference}
              onPress={() => setCorreoPreferido(preference)}
              style={[
                styles.preferenceOption,
                correoPreferido === preference && styles.preferenceOptionSelected,
              ]}>
              <View style={[
                styles.radioOuter,
                correoPreferido === preference && styles.radioOuterSelected,
              ]}>
                {correoPreferido === preference && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.preferenceText}>
                {preference === 'institucional' ? 'Institucional' : 'Personal'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.container, styles.keyboardContent]}
        enableOnAndroid
        extraScrollHeight={20}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
            <Text style={styles.eyebrow}>MI CUENTA</Text>
            <Text style={styles.title}>Editar perfil</Text>
            <Text style={styles.subtitle}>Actualiza tus datos personales y académicos.</Text>

            {(user.rol === 'supervisor'
              || (user.rol === 'alumno' && user.origen_datos === 'manual')) && (
              <ProfileInput
                label="Nombres y Apellidos"
                placeholder="Escribe tus nombres y apellidos"
                value={nombre}
                onChangeText={setNombre}
              />
            )}
            {user.rol === 'alumno' && user.origen_datos === 'manual' && (
              <ProfileInput label="Facultad" value={facultad} onChangeText={setFacultad} />
            )}
            {user.rol === 'supervisor' && (
              <ProfileInput label="Especialidad / Área" value={carrera} onChangeText={setCarrera} />
            )}
            <ProfileInput
              label="Teléfono"
              placeholder="Número de celular"
              value={telefono}
              onChangeText={(value) => setTelefono(value.replace(/[^\d+()\s-]/g, ''))}
              keyboardType="phone-pad"
              maxLength={20}
            />
            {user.rol === 'supervisor' && (
              <View style={styles.inputGroup}>
                <ProfileInput
                  label="Correo de Contacto"
                  placeholder="correo@ejemplo.com"
                  value={correoPersonal}
                  onChangeText={setCorreoPersonal}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={254}
                />
                {correoPersonal.trim() !== '' && (
                  <Text style={styles.warning}>
                    Al cambiar el correo, deberás verificarlo nuevamente
                  </Text>
                )}
              </View>
            )}
            {user.rol === 'alumno' && user.origen_datos === 'api' && (
              <>
                <View style={styles.readOnlyField}>
                  <Text style={styles.label}>Correo Institucional</Text>
                  <Text selectable style={styles.readOnlyValue}>
                    {user.correo_institucional || 'No disponible'}
                  </Text>
                </View>
                <ProfileInput
                  label="Correo Personal"
                  placeholder="correo@ejemplo.com"
                  value={correoPersonal}
                  onChangeText={setCorreoPersonal}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={254}
                />
                {renderEmailPreference()}
              </>
            )}
            {user.rol === 'alumno' && user.origen_datos === 'manual' && (
              <>
                <ProfileInput
                  label="Correo Institucional"
                  placeholder="correo@unheval.edu.pe"
                  value={correoInstitucional}
                  onChangeText={setCorreoInstitucional}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={254}
                />
                <ProfileInput
                  label="Correo Personal"
                  placeholder="correo@ejemplo.com"
                  value={correoPersonal}
                  onChangeText={setCorreoPersonal}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={254}
                />
                {renderEmailPreference()}
              </>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={isSaving}
              onPress={() => void handleSave()}
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressed, isSaving && styles.disabled]}>
              {isSaving
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.saveText}>Guardar Cambios</Text>}
            </Pressable>

            {user.rol === 'supervisor' && (
              <View style={styles.passwordSection}>
                <Text style={styles.sectionTitle}>Cambiar Contraseña</Text>
                <View style={styles.passwordInput}>
                  <TextInput
                    accessibilityLabel="Nueva contraseña"
                    autoCapitalize="none"
                    autoCorrect={false}
                    onChangeText={setPassword}
                    placeholder="********"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPassword}
                    style={styles.passwordTextInput}
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onPress={() => setShowPassword((current) => !current)}
                    style={styles.passwordVisibilityButton}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={colors.text}
                    />
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleUpdatePassword}
                  style={({ pressed }) => [styles.passwordButton, pressed && styles.pressed]}>
                  <Text style={styles.passwordButtonText}>Actualizar Contraseña</Text>
                </Pressable>
              </View>
            )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

function ProfileInput({
  label,
  placeholder = label,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'words',
  maxLength = 150,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words';
  maxLength?: number;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCapitalize === 'words'}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#E0E0E0"
        style={styles.input}
        maxLength={maxLength}
        returnKeyType="next"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  keyboardContent: { paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  card: { width: '100%', maxWidth: 600, alignSelf: 'center', gap: 16, padding: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, ...cardElevation },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.3 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, marginBottom: 4 },
  inputGroup: { gap: 6 },
  label: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, color: colors.text, backgroundColor: 'rgba(255, 255, 255, 0.1)', fontFamily: fonts.body, fontSize: 15 },
  readOnlyField: { gap: 6, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  readOnlyValue: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 15 },
  preferenceGroup: { gap: 9 },
  preferenceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preferenceOption: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  preferenceOptionSelected: { borderColor: colors.earth, backgroundColor: 'rgba(255, 255, 255, 0.14)' },
  radioOuter: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.textMuted, borderRadius: 9 },
  radioOuterSelected: { borderColor: colors.earth },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.earth },
  preferenceText: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  warning: { color: colors.earth, fontFamily: fonts.body, fontSize: 11 },
  saveButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary, marginTop: 4, ...cardElevation },
  saveText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 15 },
  passwordSection: { gap: 12, marginTop: 8, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border },
  sectionTitle: { color: colors.text, fontFamily: fonts.display, fontSize: 19 },
  passwordInput: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surfaceMuted },
  passwordTextInput: { minHeight: 48, flex: 1, color: colors.text, backgroundColor: 'transparent', fontFamily: fonts.body, fontSize: 15 },
  passwordVisibilityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  passwordButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF' },
  passwordButtonText: { color: '#17211D', fontFamily: fonts.semibold, fontSize: 14 },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.6 },
});
