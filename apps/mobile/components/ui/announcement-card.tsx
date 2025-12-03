import { TextSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import ThemedText from "../themed-text";

interface AnnouncementCardProps {
  title: string;
  content: string;
  priority: 'normal' | 'important' | 'urgent';
  publishedAt?: string | null;
}

export default function AnnouncementCard({ title, content, priority, publishedAt }: AnnouncementCardProps) {
  const themeColor = useThemeColor({}, 'neutral');
  const cardColor = useThemeColor({}, 'card');
  const textColor = useThemeColor({}, 'text');
  const primaryColor = useThemeColor({}, 'primary');

  const icon = priority === 'urgent' ? 'alert-circle' : priority === 'important' ? 'notifications-circle' : 'notifications-circle';
  const priorityIconColor = priority === 'urgent'
    ? "#ED474A"
    : primaryColor;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <View style={[styles.container, { borderColor: themeColor, backgroundColor: cardColor }]}>
      <View>
        <Ionicons name={icon} size={40} color={priorityIconColor} />
      </View>
      <View style={{ gap: 4, flex: 1 }}>
        {publishedAt && (
          <ThemedText style={{ color: textColor, fontSize: TextSize.small, opacity: 0.6 }}>
            {formatDate(publishedAt)}
          </ThemedText>
        )}
        <ThemedText style={{ color: textColor, fontSize: TextSize.h5, fontWeight: '600' }}>{title}</ThemedText>
        <ThemedText style={{ color: textColor, fontSize: TextSize.p, lineHeight: 20, opacity: 0.7 }}>{content}</ThemedText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});