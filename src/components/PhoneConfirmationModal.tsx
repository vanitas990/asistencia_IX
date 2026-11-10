import { useState } from 'react';
import { BlurView } from 'expo-blur';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { colors, fonts } from '@/theme';

interface PhoneConfirmationModalProps {
  visible: boolean;
  telefonoActual: string | null;
  onConfirm: () => void;
  onRequestClose: () => void;
}

export default function PhoneConfirmationModal({
  visible,
  telefonoActual,
  onConfirm,
  onRequestClose,
}: PhoneConfirmationModalProps) {
  const { updatePhone } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function closeModal() {
    setIsUpdating(false);
    setNewPhone('');
    onRequestClose();
  }

  function confirmPhone() {
    onConfirm();
    closeModal();
  }

  function showMessage(title: string, message: string) {
    if (Platform.OS === 'web') {
      globalThis.alert(`${title}\n\n${message}`);
      return;
    }
    Alert.alert(title, message);
  }

  async function savePhone() {
    const phone = newPhone.trim();
    if (!/^[+()\d\s-]{7,20}$/.test(phone)) {
      showMessage('Número no válido', 'Ingresa un teléfono válido de entre 7 y 20 caracteres.');
      return;
    }

    setIsSaving(true);
    try {
      await updatePhone(phone);
      showMessage('¡Teléfono actualizado!', 'Tu número se guardó correctamente.');
      closeModal();
    } catch (saveError) {
      console.error('No se pudo actualizar el teléfono.', saveError);
      showMessage(
        'No se pudo actualizar el teléfono',
        saveError instanceof Error ? saveError.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  const currentPhone = telefonoActual?.trim() || null;
  const isUpdatingPhone = isUpdating || !currentPhone;

  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!isSaving) closeModal();
      }}
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <BlurView intensity={80} tint="dark" style={styles.card}>
          <Text style={styles.eyebrow}>CONFIRMACIÓN DE TELÉFONO</Text>
          <Text style={styles.title}>
            {isUpdatingPhone
              ? currentPhone
                ? 'Ingresa tu nuevo número de celular para que tu supervisor pueda contactarte.'
                : 'No tenemos un número registrado. Ingresa tu celular para que tu supervisor pueda contactarte.'
              : `Hemos encontrado este número en la UNHEVAL: ${currentPhone}. ¿Es tu número actual?`}
          </Text>

          {isUpdatingPhone ? (
            <>
              <TextInput
                accessibilityLabel="Nuevo número de celular"
                autoComplete="tel"
                keyboardType="phone-pad"
                maxLength={20}
                onChangeText={setNewPhone}
                placeholder="Número de celular"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={newPhone}
              />
              <Pressable
                accessibilityRole="button"
                disabled={isSaving}
                onPress={() => void savePhone()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isSaving && styles.disabled]}>
                {isSaving
                  ? (
                    <View style={styles.loadingButtonContent}>
                      <ActivityIndicator color="#111827" />
                      <Text style={styles.primaryButtonText}>Cargando...</Text>
                    </View>
                  )
                  : <Text style={styles.primaryButtonText}>Guardar</Text>}
              </Pressable>
            </>
          ) : (
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={confirmPhone}
                style={({ pressed }) => [styles.primaryButton, styles.actionButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Sí, es mío</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsUpdating(true)}
                style={({ pressed }) => [styles.secondaryButton, styles.actionButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>No, actualizar</Text>
              </Pressable>
            </View>
          )}
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.62)',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 18,
    overflow: 'hidden',
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    backgroundColor: 'rgba(12, 19, 28, 0.88)',
  },
  eyebrow: {
    color: colors.earth,
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 140,
  },
  primaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  primaryButtonText: {
    color: '#111827',
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  secondaryButtonText: {
    color: colors.text,
    fontFamily: fonts.semibold,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.6,
  },
});
