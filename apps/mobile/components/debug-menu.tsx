import api from "@/api";
import Button from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface DebugMenuProps {
    screenName?: string;
    customActions?: {
        label: string;
        onPress: () => void;
    }[];
}

export default function DebugMenu({ screenName, customActions = [] }: DebugMenuProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const textColor = useThemeColor({}, 'text');
    const cardColor = useThemeColor({}, 'card');
    const neutralColor = useThemeColor({}, 'neutral');
    const { signOut } = useAuth();
    async function forceQRValidation(): Promise<void> {
        try {
            const { data: { location_id, organization_id } } = await api.validateQR('7b226f7267616e697a6174696f6e5f6964223a2249787366437946704f3735445743754c554c417447436b52667432524151484a222c226c6f636174696f6e5f6964223a2233383434353938352d303133662d343536372d613863632d343865336666623436626537227d71725f7365637265745f736b795f68725f68756d616e5f7265736f75726365735f6170706c69636174696f6e');
            router.navigate(`/(protected)/biometrics-scanner?location_id=${location_id}&organization_id=${organization_id}`);
        } catch (error) {
            console.error('Debug QR validation error:', error);
            // Silently fail in debug menu - don't show alerts
        }
    }

    const handleSignOut = async () => {
        try {
            // Try to sign out - this may fail due to circular reference issues in Better Auth
            await signOut();
        } catch (error) {
            // Sign out may fail due to circular reference issues in Better Auth's internal state
            // This is a known issue when Better Auth tries to serialize React Query state
            console.warn('Sign out error (non-critical, session will be cleared on next request):', error);
        } finally {
            // Always navigate to welcome screen regardless of signOut success/failure
            router.replace('/(public)/auth/welcome');
        }
    };

    const defaultActions = [
        {
            label: 'Home',
            onPress: () => router.navigate('/(protected)/(tabs)'),
        },
        {
            label: 'QR Scanner',
            onPress: () => router.navigate('/(protected)/qr-scanner'),
        },
        {
            label: 'Biometrics Scanner',
            onPress: forceQRValidation,
        },
        {
            label: 'Settings',
            onPress: () => router.navigate('/(protected)/(tabs)/settings'),
        },
        {
            label: 'Visitors',
            onPress: () => router.navigate('/(protected)/visitors'),
        },
        {
            label: 'Sign Out',
            onPress: handleSignOut,
        },
        {
            label: 'Sign Up',
            onPress: () => router.navigate('/(public)/auth/sign-up'),
        },
        {
            label: 'Sign In',
            onPress: () => router.navigate('/(public)/auth/sign-in'),
        },
        {
            label: 'Welcome',
            onPress: () => router.navigate('/(public)/auth/welcome'),
        },
        {
            label: 'No Organization',
            onPress: () => router.navigate('/(no-org)')
        },
        ...customActions,
    ];

    return (
        <View style={styles.container}>
            {isExpanded && (
                <View style={[styles.menu, { backgroundColor: cardColor, borderColor: neutralColor }]}>
                    {screenName && (
                        <View style={styles.screenNameContainer}>
                            <View style={[styles.screenNameBadge, { backgroundColor: neutralColor }]}>
                                <Text style={[styles.screenNameText, { color: textColor }]}>
                                    {screenName}
                                </Text>
                            </View>
                        </View>
                    )}
                    <ScrollView 
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollViewContent}
                        showsVerticalScrollIndicator={true}
                    >
                        {defaultActions.map((action, index) => (
                            <Button
                                key={index}
                                onPress={() => {
                                    action.onPress();
                                    setIsExpanded(false);
                                }}
                                style={styles.menuButton}
                            >
                                {action.label}
                            </Button>
                        ))}
                    </ScrollView>
                </View>
            )}
            <TouchableOpacity
                style={[styles.toggleButton, { backgroundColor: cardColor, borderColor: neutralColor }]}
                onPress={() => setIsExpanded(!isExpanded)}
            >
                <Ionicons 
                    name={isExpanded ? "close" : "menu"} 
                    size={20} 
                    color={textColor} 
                />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        right: 16,
        zIndex: 1000,
    },
    toggleButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    menu: {
        position: 'absolute',
        top: 48,
        right: 0,
        minWidth: 200,
        maxHeight: 400,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    scrollView: {
        flexGrow: 0,
    },
    scrollViewContent: {
        gap: 8,
    },
    menuButton: {
        marginBottom: 0,
    },
    screenNameContainer: {
        marginBottom: 8,
    },
    screenNameBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    screenNameText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
