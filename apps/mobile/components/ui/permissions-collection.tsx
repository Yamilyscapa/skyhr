import ThemedText from "@/components/themed-text";
import PermissionCard from "@/components/ui/permission-card";
import Skeleton from "@/components/ui/skeleton";
import { TextSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Permission } from "@/modules/permissions/types";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";

interface PermissionsCollectionProps {
    permissions: Permission[];
    loading?: boolean;
    refreshing?: boolean;
    error?: string | null;
    onRefresh?: () => void;
    variant?: 'compact' | 'full';
    showTitle?: boolean;
    title?: string;
    showUserInfo?: boolean;
}

export default function PermissionsCollection({
    permissions,
    loading = false,
    refreshing = false,
    error = null,
    onRefresh,
    variant = 'full',
    showTitle = true,
    title = 'Permisos',
    showUserInfo = false,
}: PermissionsCollectionProps) {
    const themeColor = useThemeColor({}, 'neutral');
    const cardColor = useThemeColor({}, 'card');
    const textColor = useThemeColor({}, 'text');
    const primaryColor = useThemeColor({}, 'primary');

    const isCompact = variant === 'compact';
    const isLoading = loading && !refreshing;
    const isEmpty = permissions.length === 0 && !loading;

    const cardStyle = [
        isCompact ? styles.compactCard : styles.fullCard,
        { borderColor: themeColor, borderWidth: 1, backgroundColor: cardColor },
    ];

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.skeletonList}>
                    {Array.from({ length: isCompact ? 2 : 3 }).map((_, index) => (
                        <View
                            key={`permission-skeleton-${index}`}
                            style={[styles.skeletonCard, { borderColor: themeColor, backgroundColor: cardColor }]}
                        >
                            <View style={styles.skeletonHeader}>
                                <Skeleton width={32} height={32} borderRadius={16} />
                                <Skeleton width={90} height={18} borderRadius={999} />
                            </View>
                            <View style={styles.skeletonBody}>
                                <View style={styles.skeletonRow}>
                                    <Skeleton width={16} height={16} borderRadius={4} />
                                    <Skeleton width="45%" height={12} borderRadius={6} />
                                </View>
                                <Skeleton width="100%" height={12} borderRadius={6} />
                                <Skeleton width="90%" height={12} borderRadius={6} />
                                <Skeleton width="40%" height={10} borderRadius={6} />
                            </View>
                        </View>
                    ))}
                </View>
            );
        }

        if (isEmpty) {
            return (
                <View style={styles.cardCenteredContent}>
                    <ThemedText style={[styles.emptyText, { color: textColor }]}>
                        No hay permisos disponibles
                    </ThemedText>
                </View>
            );
        }

        return (
            <FlatList
                style={styles.flatList}
                data={permissions}
                renderItem={({ item }) => (
                    <PermissionCard
                        permission={item}
                        showUserInfo={showUserInfo}
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
    skeletonList: {
        gap: 12,
        paddingBottom: 8,
    },
    skeletonCard: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        gap: 12,
    },
    skeletonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    skeletonBody: {
        gap: 8,
    },
    skeletonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
});
