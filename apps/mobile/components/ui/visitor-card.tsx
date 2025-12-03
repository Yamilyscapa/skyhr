import { TextSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Visitor, VisitorStatus } from "@/modules/visitors/types";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import ThemedText from "../themed-text";
import api from "@/api";
import { useEffect } from "react";

interface VisitorCardProps {
    visitor: Visitor;
}

export default function VisitorCard({ visitor }: VisitorCardProps) {
    const themeColor = useThemeColor({}, 'neutral');
    const cardColor = useThemeColor({}, 'card');
    const textColor = useThemeColor({}, 'text');
    const primaryColor = useThemeColor({}, 'primary');

    const getStatusColor = (status: VisitorStatus) => {
        switch (status) {
            case 'approved':
                return '#0F9D58';
            case 'rejected':
                return '#ED474A';
            case 'pending':
                return '#B45309';
            case 'cancelled':
                return '#71717a'; // Zinc 500
            default:
                return primaryColor;
        }
    };

    const getStatusIcon = (status: VisitorStatus) => {
        switch (status) {
            case 'approved':
                return 'checkmark-circle';
            case 'rejected':
                return 'close-circle';
            case 'pending':
                return 'time';
            case 'cancelled':
                return 'ban';
            default:
                return 'person';
        }
    };

    const getStatusLabel = (status: VisitorStatus) => {
        switch (status) {
            case 'approved':
                return 'Aprobado';
            case 'rejected':
                return 'Rechazado';
            case 'pending':
                return 'Pendiente';
            case 'cancelled':
                return 'Cancelado';
            default:
                return status;
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '---';
        
        // Handle potential SQL timestamp format issues on iOS (e.g. "2023-01-01 12:00:00")
        // by replacing space with T to make it ISO-8601 compliant
        const safeDateString = dateString.includes(' ') && !dateString.includes('T') 
            ? dateString.replace(' ', 'T') 
            : dateString;

        const date = new Date(safeDateString);
        
        if (isNaN(date.getTime())) {
            return dateString || 'Fecha inválida';
        }

        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const statusColor = getStatusColor(visitor.status);
    const statusIcon = getStatusIcon(visitor.status);
    const statusLabel = getStatusLabel(visitor.status);

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
                <ThemedText style={[styles.name, { color: textColor }]}>
                    {visitor.name}
                </ThemedText>

                <View style={styles.row}>
                    <Ionicons name="calendar-outline" size={16} color={textColor} style={{ opacity: 0.6 }} />
                    <View>
                        <ThemedText style={[styles.label, { color: textColor }]}>Entrada:</ThemedText>
                        <ThemedText style={[styles.value, { color: textColor }]}>
                            {formatDate(visitor.entryDate)}
                        </ThemedText>
                    </View>
                </View>

                <View style={styles.row}>
                    <Ionicons name="calendar-outline" size={16} color={textColor} style={{ opacity: 0.6 }} />
                    <View>
                        <ThemedText style={[styles.label, { color: textColor }]}>Salida:</ThemedText>
                        <ThemedText style={[styles.value, { color: textColor }]}>
                            {formatDate(visitor.exitDate)}
                        </ThemedText>
                    </View>
                </View>

                {visitor.accessAreas && visitor.accessAreas.length > 0 && (
                    <View style={styles.areasContainer}>
                        <Ionicons name="location-outline" size={16} color={textColor} style={{ opacity: 0.6 }} />
                        <View style={{ flex: 1 }}>
                            <ThemedText style={[styles.label, { color: textColor }]}>Áreas de acceso:</ThemedText>
                            <View style={styles.areasList}>
                                {visitor.accessAreas.map((area, index) => (
                                    <View key={index} style={[styles.areaTag, { borderColor: themeColor }]}>
                                        <ThemedText style={[styles.areaText, { color: textColor }]}>
                                            {area}
                                        </ThemedText>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {visitor.status === 'approved' && visitor.approvedAt && (
                    <View style={[styles.approvalInfo, { backgroundColor: `${themeColor}20`, borderColor: themeColor }]}>
                        <ThemedText style={[styles.approvalText, { color: textColor }]}>
                            Aprobado el {formatDate(visitor.approvedAt)}
                        </ThemedText>
                    </View>
                )}
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
        gap: 12,
    },
    name: {
        fontSize: TextSize.h5,
        fontWeight: 'bold',
    },
    row: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'flex-start',
    },
    label: {
        fontSize: TextSize.small,
        opacity: 0.6,
    },
    value: {
        fontSize: TextSize.p,
        fontWeight: '500',
    },
    areasContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    areasList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    areaTag: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 6,
        borderWidth: 1,
    },
    areaText: {
        fontSize: TextSize.small,
    },
    approvalInfo: {
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 4,
    },
    approvalText: {
        fontSize: TextSize.small,
        opacity: 0.8,
    }
});
