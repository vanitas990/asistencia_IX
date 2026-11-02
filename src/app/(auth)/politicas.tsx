import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { cardElevation, colors, fonts } from '@/theme';

const sections = [
  {
    title: '1. Información general',
    paragraphs: [
      'La presente Política de Privacidad establece las condiciones bajo las cuales la aplicación móvil ASISTENCIA IX, desarrollada para la Universidad Nacional Hermilio Valdizán (UNHEVAL), recopila, utiliza, almacena y protege los datos personales de sus usuarios.',
      'La aplicación tiene como finalidad facilitar y gestionar el control de asistencia académica de los estudiantes, garantizando el tratamiento responsable y confidencial de su información personal.',
      'El tratamiento de los datos se realiza conforme a la Ley N.º 29733, Ley de Protección de Datos Personales, y su reglamento vigente en el Perú.',
    ],
  },
  {
    title: '2. Datos personales recopilados',
    paragraphs: [
      'Para el funcionamiento de la aplicación, se recopilan los siguientes datos personales:',
      '• DNI: número del Documento Nacional de Identidad del estudiante.\n• Nombre completo: identificación del estudiante.\n• Carrera profesional: programa académico al que pertenece.\n• Facultad: unidad académica correspondiente.\n• Registro de asistencias: fechas y horas en las que se registra la asistencia del estudiante.',
      'La aplicación recopila únicamente la información necesaria para cumplir con su finalidad académica.',
    ],
  },
  {
    title: '3. Finalidad del tratamiento de datos',
    paragraphs: [
      'Los datos personales recopilados se utilizan exclusivamente para las siguientes actividades:',
      '• Identificar correctamente a los estudiantes.\n• Registrar y gestionar la asistencia a las actividades académicas.\n• Consultar el historial de asistencias.\n• Facilitar el seguimiento y control de asistencia por parte del personal universitario autorizado.\n• Generar información de asistencia necesaria para la gestión académica.',
      'Los datos personales no serán utilizados para fines comerciales, publicitarios ni para propósitos ajenos al control de asistencia académica.',
    ],
  },
  {
    title: '4. Almacenamiento y seguridad de la información',
    paragraphs: [
      'La información recopilada mediante ASISTENCIA IX se almacena en una base de datos alojada en la plataforma Neon, mientras que los servicios del backend se ejecutan en servidores de la Universidad Nacional Hermilio Valdizán (UNHEVAL).',
      'Se adoptan medidas técnicas y organizativas destinadas a proteger los datos personales frente a accesos no autorizados, pérdida, alteración, divulgación o cualquier tratamiento indebido.',
      'El acceso a la información está limitado al personal autorizado que necesite utilizarla para cumplir las funciones relacionadas con el control de asistencia académica.',
    ],
  },
  {
    title: '5. Compartición de datos personales',
    paragraphs: [
      'ASISTENCIA IX no vende, comercializa ni comparte los datos personales de sus usuarios con terceros para fines publicitarios o comerciales.',
      'La información recopilada se utiliza exclusivamente dentro del ámbito de la gestión académica de la universidad.',
      'La utilización de proveedores tecnológicos para el alojamiento de la base de datos y la infraestructura del sistema no implica que estos puedan utilizar libremente la información personal de los estudiantes. Su tratamiento deberá limitarse a las condiciones necesarias para prestar dichos servicios y a las obligaciones legales correspondientes.',
    ],
  },
  {
    title: '6. Conservación de los datos',
    paragraphs: [
      'Los datos personales se conservarán durante el tiempo necesario para cumplir con las finalidades académicas y administrativas para las que fueron recopilados, así como durante los plazos de conservación que resulten aplicables conforme a la normativa vigente y las disposiciones institucionales de la universidad.',
      'Cuando los datos dejen de ser necesarios y no exista una obligación legal o administrativa que justifique su conservación, se procederá a su eliminación o al tratamiento que corresponda conforme a la legislación aplicable.',
    ],
  },
  {
    title: '7. Derechos de los usuarios',
    paragraphs: [
      'Los estudiantes pueden ejercer los derechos reconocidos por la Ley N.º 29733, entre ellos:',
      '• Derecho de información: conocer cómo y para qué se utilizan sus datos personales.\n• Derecho de acceso: solicitar información sobre los datos personales que se encuentran almacenados.\n• Derecho de rectificación: solicitar la corrección de datos personales incorrectos, incompletos o desactualizados.\n• Derecho de cancelación: solicitar la eliminación de sus datos personales cuando corresponda legalmente.\n• Derecho de oposición: oponerse al tratamiento de sus datos personales en los casos previstos por la legislación vigente.',
    ],
  },
  {
    title: '8. Solicitud de eliminación de datos personales',
    paragraphs: [
      'Los usuarios que deseen solicitar la eliminación de sus datos personales podrán presentar una solicitud formal ante la Universidad Nacional Hermilio Valdizán (UNHEVAL), a través de sus canales oficiales de atención o de la unidad responsable de la protección de datos personales.',
      'La solicitud deberá permitir identificar al estudiante e indicar los datos cuya eliminación solicita.',
      'La universidad evaluará la solicitud y procederá conforme a los plazos y condiciones establecidos en la normativa peruana. La eliminación podrá estar sujeta a las obligaciones legales, académicas o administrativas que justifiquen la conservación de determinados registros.',
    ],
  },
  {
    title: '9. Modificaciones de la política de privacidad',
    paragraphs: [
      'La Universidad Nacional Hermilio Valdizán se reserva el derecho de actualizar esta Política de Privacidad cuando resulte necesario debido a cambios en el funcionamiento de ASISTENCIA IX, mejoras en sus medidas de seguridad o modificaciones en la legislación aplicable.',
      'Cualquier modificación será comunicada a través de los medios institucionales correspondientes o mediante la propia aplicación.',
    ],
  },
  {
    title: '10. Contacto',
    paragraphs: [
      'Para consultas, solicitudes de acceso, rectificación, cancelación u oposición al tratamiento de datos personales, los usuarios podrán comunicarse con la Universidad Nacional Hermilio Valdizán mediante sus canales oficiales de atención.',
      '• Institución responsable: Universidad Nacional Hermilio Valdizán (UNHEVAL).\n• Aplicación: ASISTENCIA IX.\n• Finalidad: Control de asistencia académica.',
      'Al utilizar ASISTENCIA IX, el usuario podrá consultar esta política para conocer las condiciones bajo las cuales se tratan sus datos personales y los mecanismos disponibles para ejercer sus derechos.',
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
          <Text style={styles.title}>POLÍTICA DE PRIVACIDAD DE ASISTENCIA IX</Text>
          <Text style={styles.updated}>Última actualización: 2 de noviembre de 2026</Text>

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
