import AnnouncementsCollection from "@/components/ui/announcements-collection";
import ThemedView from "@/components/ui/themed-view";
import { useAnnouncements } from "@/modules/announcements/use-announcements";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AnnouncementsScreen() {
    const {
        announcements,
        loading,
        refreshing,
        error,
        fetchAnnouncements,
    } = useAnnouncements();

    useFocusEffect(
        useCallback(() => {
            fetchAnnouncements();
        }, [fetchAnnouncements])
    );

    const onRefresh = useCallback(() => {
        fetchAnnouncements(true);
    }, [fetchAnnouncements]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <ThemedView style={{ flex: 1 }}>
                    <AnnouncementsCollection
                        announcements={announcements}
                        loading={loading}
                        refreshing={refreshing}
                        error={error}
                        onRefresh={onRefresh}
                        variant="full"
                    />
            </ThemedView>
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
});