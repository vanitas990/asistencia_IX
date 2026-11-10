export const colors = {
  background: 'transparent',
  surface: 'rgba(12, 19, 28, 0.72)',
  surfaceMuted: 'rgba(255, 255, 255, 0.08)',
  primary: '#344D41',
  primaryLight: '#708477',
  text: '#FFFFFF',
  textMuted: '#E0E0E0',
  border: 'rgba(255, 255, 255, 0.32)',
  earth: '#D8C1A5',
  earthLight: 'rgba(255, 255, 255, 0.12)',
  success: '#A8D9B6',
  successBackground: 'rgba(72, 145, 96, 0.25)',
  danger: '#FFB4AB',
  dangerBackground: 'rgba(190, 75, 65, 0.24)',
};

export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const cardElevation = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.15,
  shadowRadius: 10,
  elevation: 8,
} as const;
