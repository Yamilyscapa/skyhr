import ThemedText from "@/components/themed-text";
import AnnouncementCard from "@/components/ui/announcement-card";
import Skeleton from "@/components/ui/skeleton";
import { TextSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Announcement } from "@/modules/announcements/types";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

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
    const isLoading = loading && !refreshing;
    const isEmpty = announcements.length === 0 && !loading;

    const cardStyle = [
        isCompact ? styles.compactCard : styles.fullCard,
        { borderColor: themeColor, borderWidth: 1, backgroundColor: cardColor },
    ];

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.skeletonList}>
                    {Array.from({ length: isCompact ? 2 : 5 }).map((_, index) => (
                        <View
                            key={`announcement-skeleton-${index}`}
                            style={[styles.skeletonCard, { borderColor: themeColor, backgroundColor: cardColor }]}
                        >
                            <Skeleton width={40} height={40} borderRadius={20} />
                            <View style={styles.skeletonTextGroup}>
                                <Skeleton width="35%" height={10} borderRadius={6} />
                                <Skeleton width="70%" height={14} borderRadius={6} />
                                <Skeleton width="100%" height={10} borderRadius={6} />
                            </View>
                        </View>
                    ))}
                </View>
            );
        }

        if (isEmpty) {
            return (
                <View style={styles.cardCenteredContent}>
                    <ThemedText style={[isCompact ? styles.compactEmptyTitle : styles.emptyText, { color: textColor }]}>
                        No hay avisos disponibles
                    </ThemedText>
                    {isCompact && (
                        <ThemedText style={[styles.compactEmptyDescription, { color: textColor }]}>
                            Cuando haya nuevos avisos aparecerán aquí.
                        </ThemedText>
                    )}
                </View>
            );
        }

        return (
            <FlatList
                style={styles.flatList}
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
        );
    };

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

            <View style={isCompact ? undefined : styles.listWrapper}>
                <View style={cardStyle}>
                    {renderContent()}
                </View>
            </View>
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
        overflow: 'hidden',
    },
    fullListContent: {
        gap: 12,
        paddingBottom: 16,
    },
    flatList: {
        flex: 1,
    },
    cardCenteredContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
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
    compactEmptyTitle: {
        fontSize: TextSize.h4,
        fontWeight: '600',
        textAlign: 'center',
    },
    compactEmptyDescription: {
        fontSize: TextSize.p,
        textAlign: 'center',
    },
    skeletonList: {
        gap: 12,
        paddingBottom: 8,
    },
    skeletonCard: {
        borderRadius: 8,
        borderWidth: 1,
        padding: 16,
        height: 100,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    skeletonTextGroup: {
        flex: 1,
        gap: 8,
    },
});
