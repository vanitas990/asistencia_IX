import { Image } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts } from '@/theme';

export default function ProfileAvatar({
  avatarUrl,
  name,
  size,
  style,
}: {
  avatarUrl: string | null;
  name: string;
  size: number;
  style?: ViewStyle;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('') || '?';

  return (
    <View
      accessibilityLabel={avatarUrl ? `Foto de perfil de ${name}` : `Avatar de ${name}`}
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}>
      {avatarUrl ? (
        <Image
          contentFit="cover"
          source={{ uri: avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(16, size * 0.34) }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.earthLight,
  },
  initials: { color: colors.primary, fontFamily: fonts.display },
});
