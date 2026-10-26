import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cardElevation, colors, fonts } from '@/theme';

const sections = [
  {
    title: '1. Identidad del Responsable',
    paragraphs: [
      'El responsable del tratamiento de sus datos es la institución educativa correspondiente y el equipo desarrollador de Asistencia IX. Puede contactarnos en: armasnestor58@gmail.com.',
    ],
  },
  {
    title: '2. Datos que recopilamos',
    paragraphs: [
      'Para el funcionamiento de la aplicación, recopilamos los siguientes datos:',
      '• Nombre y apellido.\n• DNI de 8 dígitos.\n• Facultad, carrera y ciclo académico.\n• Historial de asistencias (fecha, hora y tipo de marcación: entrada o salida).\n• Fotografía de perfil (opcional, si el usuario decide subirla).',
    ],
  },
  {
    title: '3. Finalidad del tratamiento',
    paragraphs: [
      'Sus datos son utilizados exclusivamente para:',
      '• El registro y control de asistencia a clases o prácticas.\n• La comunicación entre supervisores/instructores y alumnos.\n• No utilizamos sus datos para fines publicitarios ni los vendemos a terceros.',
    ],
  },
  {
    title: '4. Base legal',
    paragraphs: [
      'El tratamiento de sus datos se basa en el consentimiento explícito que usted otorga al marcar la casilla de aceptación al momento de crear su cuenta.',
    ],
  },
  {
    title: '5. Retención de datos',
    paragraphs: [
      'Sus datos serán conservados mientras su cuenta permanezca activa. Si usted solicita la eliminación de su cuenta, sus datos personales y su historial de asistencias serán eliminados de nuestros servidores.',
    ],
  },
  {
    title: '6. Derechos del usuario',
    paragraphs: [
      'Usted tiene derecho a acceder, rectificar o eliminar su información. Puede ejercer estos derechos directamente desde la sección de "Perfil" de la aplicación o contactando al administrador.',
    ],
  },
  {
    title: '7. Terceros y Seguridad',
    paragraphs: [
      'Sus datos se almacenan de forma segura utilizando la infraestructura en la nube de Neon (PostgreSQL) y Render. Implementamos medidas de seguridad como cifrado de contraseñas y tokens de sesión para proteger su información.',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backText}>‹  Volver</Text>
        </Pressable>
        <Text style={styles.headerLabel}>ASISTENCIA IX</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.policyCard}>
          <Text style={styles.eyebrow}>INFORMACIÓN LEGAL</Text>
          <Text style={styles.title}>Política de privacidad de Asistencia IX</Text>
          <Text style={styles.updated}>Última actualización: 26 de octubre de 2026</Text>

          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  backText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 15 },
  headerLabel: { color: colors.primary, fontFamily: fonts.display, fontSize: 13, letterSpacing: 0.8 },
  scrollContent: { flexGrow: 1, padding: 20, paddingBottom: 32 },
  policyCard: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    gap: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...cardElevation,
  },
  eyebrow: { color: colors.earth, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.2 },
  title: { color: colors.text, fontFamily: fonts.display, fontSize: 27, lineHeight: 35 },
  updated: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  section: { gap: 8 },
  sectionTitle: { color: colors.primary, fontFamily: fonts.display, fontSize: 18 },
  paragraph: { color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  pressed: { opacity: 0.7 },
});
