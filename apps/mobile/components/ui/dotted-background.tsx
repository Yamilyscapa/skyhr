import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

interface DottedBackgroundProps {
  backgroundColor: string;
  dotColor: string;
  dotRadius?: number;
  dotSpacing?: number;
  style?: StyleProp<ViewStyle>;
}

export default function DottedBackground({
  backgroundColor,
  dotColor,
  dotRadius = 1.5,
  dotSpacing = 12,
  style,
}: DottedBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor }]} />
      <Svg height="100%" width="100%" style={styles.svg} pointerEvents="none">
        <Defs>
          <Pattern
            id="dotted-background-pattern"
            width={dotSpacing}
            height={dotSpacing}
            patternUnits="userSpaceOnUse"
          >
            <Circle
              cx={dotSpacing / 2}
              cy={dotSpacing / 2}
              r={dotRadius}
              fill={dotColor}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#dotted-background-pattern)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  svg: {
    ...StyleSheet.absoluteFillObject,
  },
});
