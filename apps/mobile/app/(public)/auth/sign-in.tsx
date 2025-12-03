import DebugMenu from '@/components/debug-menu';
import ThemedText from '@/components/themed-text';
import Button from '@/components/ui/button';
import { TextSize } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { signIn, session, activeOrganization, organizations } = useAuth();
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const neutralColor = useThemeColor({}, 'neutral');
    const primaryColor = useThemeColor({}, 'primary');
    const cardColor = useThemeColor({}, 'card');
    const colorScheme = useColorScheme();

    const handleSignIn = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa tu email y contraseña');
            return;
        }

        setIsLoading(true);
        try {
            const result = await signIn.email({
                email,
                password,
            });

            if (result.error) {
                Alert.alert('Error', result.error.message || 'Error al iniciar sesión');
            } else {
                // Refetch session and organization data after successful sign-in
                // Layout guards will handle navigation once queries settle
                await Promise.allSettled([
                    session.refetch(),
                    activeOrganization.refetch?.(),
                    organizations.refetch?.(),
                ]);
            }
        } catch (error) {
            console.error('Sign in error:', error);
            let errorMessage = 'Error al iniciar sesión. Por favor intenta de nuevo.';
            
            if (error instanceof Error) {
                // Better Auth might return specific error messages
                if (error.message.includes('Invalid') || error.message.includes('invalid')) {
                    errorMessage = 'Email o contraseña incorrectos. Verifica tus credenciales.';
                } else if (error.message.includes('network') || error.message.includes('Network')) {
                    errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
                } else {
                    errorMessage = error.message || errorMessage;
                }
            }
            
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const navigateToSignUp = () => {
        router.push('/(public)/auth/sign-up');
    };

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <DebugMenu screenName="Sign In" />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.form}>
                        <ThemedText style={[styles.title, { fontSize: TextSize.h1 }]}>Bienvenido a SkyHR</ThemedText>
                        <ThemedText style={[styles.subtitle, { fontSize: TextSize.h3 }]}>Inicia sesión en tu cuenta</ThemedText>

                        <TextInput
                            style={[styles.input, { 
                                borderColor: neutralColor, 
                                backgroundColor: cardColor,
                                color: textColor 
                            }]}
                            placeholder="Email"
                            placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoComplete="email"
                            editable={!isLoading}
                        />

                        <TextInput
                            style={[styles.input, { 
                                borderColor: neutralColor, 
                                backgroundColor: cardColor,
                                color: textColor 
                            }]}
                            placeholder="Contraseña"
                            placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            autoComplete="password"
                            editable={!isLoading}
                        />

                        <Button
                            onPress={handleSignIn}
                            type={isLoading ? 'secondary' : 'primary'}
                            style={styles.button}
                        >
                            {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </Button>
                        
                        <View style={styles.signUpContainer}>
                            <ThemedText style={styles.signUpText}>¿No tienes cuenta? </ThemedText>
                            <TouchableOpacity onPress={navigateToSignUp} disabled={isLoading}>
                                <ThemedText style={[styles.signUpLink, { color: primaryColor }]}>Regístrate</ThemedText>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    form: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    title: {
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        marginBottom: 32,
        opacity: 0.7,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        fontSize: 16,
    },
    button: {
        marginTop: 8,
    },
    signUpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    signUpText: {
        fontSize: 16,
        opacity: 0.7,
    },
    signUpLink: {
        fontSize: 16,
        fontWeight: '600',
    },
});
