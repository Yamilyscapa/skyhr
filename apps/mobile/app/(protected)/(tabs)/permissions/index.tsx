import PermissionRequestModal from "@/components/permission-request-modal";
import PermissionsCollection from "@/components/ui/permissions-collection";
import ThemedView from "@/components/ui/themed-view";
import { useThemeColor } from "@/hooks/use-theme-color";
import { usePermissions } from "@/modules/permissions/use-permissions";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function PermissionsScreen() {
    const {
        permissions,
        loading,
        refreshing,
        error,
        fetchPermissions,
    } = usePermissions();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const primaryColor = useThemeColor({}, 'primary');
    const insets = useSafeAreaInsets(); 
    useFocusEffect(
        useCallback(() => {
            fetchPermissions();
        }, [fetchPermissions])
    );

    const onRefresh = useCallback(() => {
        fetchPermissions(true);
    }, [fetchPermissions]);

    const handleModalSuccess = useCallback(() => {
        fetchPermissions(true);
    }, [fetchPermissions]);

    return (
        <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
            <ThemedView style={{ flex: 1 }}>
                <PermissionsCollection
                    permissions={permissions}
                    loading={loading}
                    refreshing={refreshing}
                    error={error}
                    onRefresh={onRefresh}
                    variant="full"
                />
                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: primaryColor }]}
                    onPress={() => setIsModalVisible(true)}
                    activeOpacity={0.8}
                >
                    <Ionicons name="add" size={28} color="#fff" />
                </TouchableOpacity>
            </ThemedView>
            <PermissionRequestModal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                onSuccess={handleModalSuccess}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
});

