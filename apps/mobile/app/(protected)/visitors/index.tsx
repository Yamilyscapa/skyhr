import { TextSize } from "@/constants/theme";
import api from "@/api";
import ThemedText from "@/components/themed-text";
import Button from "@/components/ui/button";
import ThemedView from "@/components/ui/themed-view";
import VisitorCard from "@/components/ui/visitor-card";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Visitor } from "@/modules/visitors/types";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Visitors() {
    const router = useRouter();
    const params = useLocalSearchParams<{ visitorId?: string }>();
    const [visitor, setVisitor] = useState<Visitor | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');

    const fetchVisitor = async (id: string) => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.getVisitor(id);
            setVisitor(response.data);
        } catch (err) {
            console.error("Error fetching visitor:", err);
            setError("No se pudo cargar la información del visitante");
            setVisitor(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (params.visitorId) {
            fetchVisitor(params.visitorId);
        }
    }, [params.visitorId]);

    const onRefresh = () => {
        if (visitor?.id) {
            setRefreshing(true);
            fetchVisitor(visitor.id);
        }
    };

    const handleScanPress = () => {
        router.push("/(protected)/visitors/scan-visitor");
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor }]}>
            <ScrollView 
                contentContainerStyle={styles.contentContainer}
                refreshControl={
                    visitor ? (
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    ) : undefined
                }
            >
                <View style={styles.header}>
                    <ThemedText style={{ fontSize: TextSize.h2, fontWeight: 'bold' }}>Control de Visitantes</ThemedText>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={textColor} />
                    </View>
                ) : error ? (
                    <View style={styles.centerContainer}>
                        <Ionicons name="alert-circle-outline" size={48} color={textColor} style={{ opacity: 0.5 }} />
                        <ThemedText style={styles.messageText}>{error}</ThemedText>
                        <Button onPress={handleScanPress} style={styles.button}>
                            Escanear Nuevo
                        </Button>
                    </View>
                ) : visitor ? (
                    <View style={styles.visitorContainer}>
                        <VisitorCard visitor={visitor} />
                        
                        <View style={styles.actionsContainer}>
                            <Button onPress={handleScanPress} type="secondary">
                                Escanear Otro Visitante
                            </Button>
                        </View>
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <View style={[styles.iconCircle, { borderColor: textColor }]}>
                            <Ionicons name="qr-code-outline" size={64} color={textColor} />
                        </View>
                        <ThemedText style={[styles.emptyTitle, { fontSize: TextSize.h4, fontWeight: '600' }]}>
                            Verificar Visitante
                        </ThemedText>
                        <ThemedText style={styles.emptyText}>
                            Escanea el código QR del visitante para ver su información y estado de acceso.
                        </ThemedText>
                        <Button onPress={handleScanPress} style={styles.mainButton}>
                            Escanear QR
                        </Button>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    header: {
        marginBottom: 24,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    visitorContainer: {
        gap: 24,
    },
    actionsContainer: {
        marginTop: 12,
    },
    messageText: {
        textAlign: 'center',
        opacity: 0.7,
    },
    button: {
        minWidth: 200,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        marginTop: -40, // Visual balance
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        opacity: 0.8,
    },
    emptyTitle: {
        textAlign: 'center',
    },
    emptyText: {
        textAlign: 'center',
        opacity: 0.7,
        maxWidth: 300,
        marginBottom: 16,
        lineHeight: 22,
    },
    mainButton: {
        minWidth: 220,
    }
});
