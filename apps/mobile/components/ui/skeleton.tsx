import { useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";
import { useThemeColor } from "@/hooks/use-theme-color";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Skeleton({
  width = '100%',
  height = 12,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const baseColor = useThemeColor({}, 'neutral');
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity,
        },
        style,
      ]}
    />
  );
}
