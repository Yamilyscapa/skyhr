import ThemedText from "@/components/themed-text";
import AnnouncementCard from "@/components/ui/announcement-card";
import { TextSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Announcement } from "@/modules/announcements/types";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

interface AnnouncementsCollectionProps {
    announcements: Announcement[];
    loading?: boolean;
    refreshing?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    variant?: 'compact' | 'full';
    showTitle?: boolean;
    title?: string;
}

export default function AnnouncementsCollection({
    announcements,
    loading = false,
    refreshing = false,
    error = null,
    onRefresh,
    variant = 'full',
    showTitle = true,
    title = 'Avisos',
}: AnnouncementsCollectionProps) {
    const themeColor = useThemeColor({}, 'neutral');
    const cardColor = useThemeColor({}, 'card');
    const textColor = useThemeColor({}, 'text');
    const primaryColor = useThemeColor({}, 'primary');

    const isCompact = variant === 'compact';

    // Loading state (only for full variant)
    if (loading && !refreshing && !isCompact) {
        return (
            <View>
                {showTitle && (
                    <ThemedText style={styles.title}>{title}</ThemedText>
                )}
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <ThemedText style={[styles.loadingText, { color: textColor }]}>
                        Cargando avisos...
                    </ThemedText>
                </View>
            </View>
        );
    }

    const cardStyle = [
        isCompact ? styles.compactCard : styles.fullCard,
        { borderColor: themeColor, borderWidth: 1, backgroundColor: cardColor },
    ];
    const noAnnouncements = announcements.length === 0 && !loading;

    return (
        <View style={isCompact ? styles.compactContainer : styles.fullContainer}>
            {showTitle && (
                <ThemedText style={isCompact ? styles.compactTitle : styles.title}>
                    {title}
                </ThemedText>
            )}
            
            {error && !isCompact && (
                <View style={[styles.errorContainer, { backgroundColor: cardColor, borderColor: themeColor }]}>
                    <ThemedText style={[styles.errorText, { color: textColor }]}>{error}</ThemedText>
                </View>
            )}

            {noAnnouncements ? (
                isCompact ? (
                    <View style={cardStyle}>
                        <View style={styles.compactEmptyState}>
                            <ThemedText style={[styles.compactEmptyTitle, { color: textColor }]}>
                                No hay avisos disponibles
                            </ThemedText>
                            <ThemedText style={[styles.compactEmptyDescription, { color: textColor }]}>
                                Cuando haya nuevos avisos aparecerán aquí.
                            </ThemedText>
                        </View>
                    </View>
                ) : (
                    <View style={styles.emptyContainer}>
                        <ThemedText style={[styles.emptyText, { color: textColor }]}>
                            No hay avisos disponibles
                        </ThemedText>
                    </View>
                )
            ) : (
                <View style={isCompact ? undefined : styles.listWrapper}>
                    <View style={cardStyle}>
                        <FlatList
                            data={announcements}
                            renderItem={({ item }) => (
                                <AnnouncementCard
                                    title={item.title}
                                    content={item.content}
                                    priority={item.priority}
                                    publishedAt={item.publishedAt}
                                />
                            )}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={isCompact ? styles.compactListContent : styles.fullListContent}
                            showsVerticalScrollIndicator={!isCompact}
                            refreshControl={onRefresh ? (
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={onRefresh}
                                    tintColor={primaryColor}
                                />
                            ) : undefined}
                        />
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    // Full variant styles
    fullContainer: {
        flex: 1,
    },
    title: {
        fontSize: TextSize.h1,
        fontWeight: 'bold',
        marginBottom: 24,
    },
    listWrapper: {
        flex: 1,
        marginTop: 8,
    },
    fullCard: {
        flex: 1,
        borderRadius: 16,
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 20,
    },
    fullListContent: {
        gap: 12,
        paddingBottom: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 48,
    },
    loadingText: {
        fontSize: TextSize.p,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyText: {
        fontSize: TextSize.h5,
        textAlign: 'center',
    },
    errorContainer: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
    },
    errorText: {
        fontSize: TextSize.p,
        textAlign: 'center',
    },
    // Compact variant styles
    compactContainer: {
        height: 300,
        paddingTop: 24,
    },
    compactTitle: {
        fontSize: TextSize.h2,
        fontWeight: '600',
    },
    compactCard: {
        marginTop: 20,
        height: 300,
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 16,
    },
    compactListContent: {
        gap: 8,
    },
    compactEmptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    compactEmptyTitle: {
        fontSize: TextSize.h4,
        fontWeight: '600',
        textAlign: 'center',
    },
    compactEmptyDescription: {
        fontSize: TextSize.p,
        textAlign: 'center',
    },
});
