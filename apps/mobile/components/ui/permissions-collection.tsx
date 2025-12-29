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
    const isLoading = loading && !refreshing;
    const isEmpty = permissions.length === 0 && !loading;

    const cardStyle = [
        isCompact ? styles.compactCard : styles.fullCard,
        { borderColor: themeColor, borderWidth: 1, backgroundColor: cardColor },
    ];

    const renderContent = () => {
        if (isLoading) {
            return (
                <View style={styles.cardCenteredContent}>
                    <ActivityIndicator size="large" color={primaryColor} />
                    <ThemedText style={[styles.loadingText, { color: textColor }]}>
                        Cargando permisos...
                    </ThemedText>
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
    loadingText: {
        fontSize: TextSize.p,
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

