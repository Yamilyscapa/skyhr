import { useThemeColor } from "@/hooks/use-theme-color";
import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from "react-native";
import ThemedText from "../themed-text";

interface ButtonProps {
  children: React.ReactNode;
  type?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  disabled?: boolean;
}

export default function Button({ children, type = 'primary', style, onPress, disabled = false }: ButtonProps) {
  const primaryColor = useThemeColor({}, 'primary');
  const secondaryColor = useThemeColor({}, 'tint');
  return (
    <TouchableOpacity
      style={[
        styles.button,
        type === 'secondary' && styles.secondary,
        { backgroundColor: type === 'secondary' ? secondaryColor : primaryColor },
        disabled && styles.disabled,
        style,
      ]}
      activeOpacity={disabled ? 1 : 0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled }}
    >
      <ThemedText
        style={[
          styles.text,
          type === 'secondary' && { color: primaryColor },
        ]}
      >
        {children}
      </ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 18,
    borderRadius: 100,
  },
  secondary: {
    backgroundColor: 'transparent',
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
