import ThemedText from "@/components/themed-text";
import PermissionCard from "@/components/ui/permission-card";
import { TextSize } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Permission } from "@/modules/permissions/types";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";

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
                        Cargando permisos...
                    </ThemedText>
                </View>
            </View>
        );
    }

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

            {permissions.length === 0 && !loading ? (
                !isCompact ? (
                    <View style={styles.emptyContainer}>
                        <ThemedText style={[styles.emptyText, { color: textColor }]}>
                            No hay permisos disponibles
                        </ThemedText>
                    </View>
                ) : null
            ) : (
                <View style={isCompact ? undefined : styles.listWrapper}>
                    <View style={[
                        isCompact ? styles.compactCard : styles.fullCard,
                        { borderColor: themeColor, borderWidth: 1, backgroundColor: cardColor }
                    ]}>
                        <FlatList
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
});

