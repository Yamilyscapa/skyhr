import { TextSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { StyleSheet, Text, TextProps } from "react-native";

export default function ThemedText({ children, style, ...rest }: TextProps) {
    const themeColor = useThemeColor({}, 'text');
    return <Text style={[styles.text, { color: themeColor }, style]} {...rest}>{children}</Text>;
}

const styles = StyleSheet.create({
    text: {
        fontSize: TextSize.p,
    },
});