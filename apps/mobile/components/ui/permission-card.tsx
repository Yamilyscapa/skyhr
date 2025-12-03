import { TextSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Permission } from "@/modules/permissions/types";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import ThemedText from "../themed-text";

interface PermissionCardProps {
    permission: Permission;
    showUserInfo?: boolean;
}

export default function PermissionCard({ permission, showUserInfo = false }: PermissionCardProps) {
    const themeColor = useThemeColor({}, 'neutral');
    const cardColor = useThemeColor({}, 'card');
    const textColor = useThemeColor({}, 'text');
    const primaryColor = useThemeColor({}, 'primary');

    const getStatusColor = (status: Permission['status']) => {
        switch (status) {
            case 'approved':
                return '#0F9D58';
            case 'rejected':
                return '#ED474A';
            case 'pending':
                return '#B45309';
            default:
                return primaryColor;
        }
    };

    const getStatusIcon = (status: Permission['status']) => {
        switch (status) {
            case 'approved':
                return 'checkmark-circle';
            case 'rejected':
                return 'close-circle';
            case 'pending':
                return 'time';
            default:
                return 'document-text';
        }
    };

    const getStatusLabel = (status: Permission['status']) => {
        switch (status) {
            case 'approved':
                return 'Aprobado';
            case 'rejected':
                return 'Rechazado';
            case 'pending':
                return 'Pendiente';
            default:
                return status;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatDateRange = (start: string, end: string) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const startFormatted = startDate.toLocaleDateString('es-ES', {
            month: 'short',
            day: 'numeric'
        });
        const endFormatted = endDate.toLocaleDateString('es-ES', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        return `${startFormatted} - ${endFormatted}`;
    };

    const statusColor = getStatusColor(permission.status);
    const statusIcon = getStatusIcon(permission.status);
    const statusLabel = getStatusLabel(permission.status);

    return (
        <View style={[styles.container, { borderColor: themeColor, backgroundColor: cardColor }]}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Ionicons name={statusIcon} size={32} color={statusColor} />
                </View>
                <View style={[styles.statusPill, { backgroundColor: `${statusColor}20` }]}>
                    <ThemedText style={[styles.statusText, { color: statusColor }]}>
                        {statusLabel}
                    </ThemedText>
                </View>
            </View>
            
            <View style={styles.content}>
                <View style={styles.dateRange}>
                    <Ionicons name="calendar-outline" size={16} color={textColor} style={{ opacity: 0.6 }} />
                    <ThemedText style={[styles.dateText, { color: textColor }]}>
                        {formatDateRange(permission.startingDate, permission.endDate)}
                    </ThemedText>
                </View>

                <ThemedText style={[styles.message, { color: textColor }]}>
                    {permission.message}
                </ThemedText>

                {permission.documentsUrl && permission.documentsUrl.length > 0 && (
                    <View style={styles.documentsContainer}>
                        <Ionicons name="document-attach-outline" size={16} color={textColor} style={{ opacity: 0.6 }} />
                        <ThemedText style={[styles.documentsText, { color: textColor }]}>
                            {permission.documentsUrl.length} documento{permission.documentsUrl.length > 1 ? 's' : ''}
                        </ThemedText>
                    </View>
                )}

                {permission.supervisorComment && (
                    <View style={[styles.commentContainer, { backgroundColor: `${themeColor}20`, borderColor: themeColor }]}>
                        <ThemedText style={[styles.commentLabel, { color: textColor }]}>
                            Comentario del supervisor:
                        </ThemedText>
                        <ThemedText style={[styles.commentText, { color: textColor }]}>
                            {permission.supervisorComment}
                        </ThemedText>
                    </View>
                )}

                <ThemedText style={[styles.createdAt, { color: textColor }]}>
                    Creado: {formatDate(permission.createdAt)}
                </ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusPill: {
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 999,
    },
    statusText: {
        fontSize: TextSize.small,
        fontWeight: '600',
    },
    content: {
        gap: 8,
    },
    dateRange: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dateText: {
        fontSize: TextSize.small,
        fontWeight: '600',
        opacity: 0.8,
    },
    message: {
        fontSize: TextSize.p,
        lineHeight: 20,
        marginTop: 4,
    },
    documentsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    documentsText: {
        fontSize: TextSize.small,
        opacity: 0.7,
    },
    commentContainer: {
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 8,
        gap: 4,
    },
    commentLabel: {
        fontSize: TextSize.small,
        fontWeight: '600',
        opacity: 0.8,
    },
    commentText: {
        fontSize: TextSize.p,
        lineHeight: 18,
    },
    createdAt: {
        fontSize: TextSize.small,
        opacity: 0.6,
        marginTop: 4,
    },
});

