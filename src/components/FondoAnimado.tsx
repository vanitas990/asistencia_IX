import { BlurTargetView } from 'expo-blur';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  createContext,
  useEffect,
  useRef,
  type ComponentRef,
  type PropsWithChildren,
  type RefObject,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';

type BlurTargetRef = RefObject<ComponentRef<typeof View> | null>;

export const FondoBlurContext = createContext<BlurTargetRef | null>(null);

const videoSource = Platform.OS === 'web'
  ? require('../../assets/fondo/pc/oscuro.mp4')
  : require('../../assets/fondo/movil/oscuro.mp4');

export default function FondoAnimado({ children }: PropsWithChildren) {
  const blurTarget = useRef<ComponentRef<typeof View>>(null);
  const player = useVideoPlayer(videoSource, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  return (
    <View style={styles.container}>
      <View pointerEvents="none" style={styles.fallback} />
      <BlurTargetView
        pointerEvents="none"
        ref={blurTarget}
        style={styles.background}>
        <VideoView
          contentFit="cover"
          nativeControls={false}
          player={player}
          surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
          style={styles.video}
        />
      </BlurTargetView>
      <FondoBlurContext.Provider value={blurTarget}>
        <View style={styles.content}>{children}</View>
      </FondoBlurContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  fallback: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
    backgroundColor: '#0f172a',
  },
  background: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
