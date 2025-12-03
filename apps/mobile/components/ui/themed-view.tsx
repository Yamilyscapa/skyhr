import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

export default function ThemedView({ children, style }: { children: React.ReactNode, style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
});