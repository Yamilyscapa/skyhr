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

export default function SignUp() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { signUp, session, activeOrganization, organizations } = useAuth();
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const neutralColor = useThemeColor({}, 'neutral');
    const primaryColor = useThemeColor({}, 'primary');
    const cardColor = useThemeColor({}, 'card');
    const colorScheme = useColorScheme();

    const handleSignUp = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden');
            return;
        }

        if (password.length < 8) {
            Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
            return;
        }

        setIsLoading(true);
        try {
            const result = await signUp.email({
                email,
                password,
                name,
            });

            if (result.error) {
                Alert.alert('Error', result.error.message || 'Error al registrarse');
            } else {
                // Refetch session and organization data after successful sign-up
                // Layout guards will handle navigation once queries settle
                await Promise.allSettled([
                    session.refetch(),
                    activeOrganization.refetch?.(),
                    organizations.refetch?.(),
                ]);
                Alert.alert('Éxito', 'Cuenta creada exitosamente');
            }
        } catch (error) {
            console.error('Sign up error:', error);
            let errorMessage = 'Error al registrarse. Por favor intenta de nuevo.';
            
            if (error instanceof Error) {
                // Better Auth might return specific error messages
                if (error.message.includes('already exists') || error.message.includes('duplicate')) {
                    errorMessage = 'Este email ya está registrado. Inicia sesión o usa otro email.';
                } else if (error.message.includes('network') || error.message.includes('Network')) {
                    errorMessage = 'Error de conexión. Verifica tu internet e intenta nuevamente.';
                } else if (error.message.includes('weak') || error.message.includes('password')) {
                    errorMessage = 'La contraseña no cumple con los requisitos de seguridad.';
                } else {
                    errorMessage = error.message || errorMessage;
                }
            }
            
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const navigateToSignIn = () => {
        router.back();
    };

    return (
        <View style={[styles.container, { backgroundColor }]}>
            <DebugMenu screenName="Sign Up" />
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.form}>
                        <ThemedText style={[styles.title, { fontSize: TextSize.h1 }]}>
                            Crear cuenta
                        </ThemedText>
                        <ThemedText style={[styles.subtitle, { fontSize: TextSize.h3 }]}>
                            Regístrate para comenzar
                        </ThemedText>

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: neutralColor,
                                    backgroundColor: cardColor,
                                    color: textColor,
                                },
                            ]}
                            placeholder="Nombre completo"
                            placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                            autoComplete="name"
                            editable={!isLoading}
                        />

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: neutralColor,
                                    backgroundColor: cardColor,
                                    color: textColor,
                                },
                            ]}
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
                            style={[
                                styles.input,
                                {
                                    borderColor: neutralColor,
                                    backgroundColor: cardColor,
                                    color: textColor,
                                },
                            ]}
                            placeholder="Contraseña"
                            placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            autoComplete="password"
                            editable={!isLoading}
                        />

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    borderColor: neutralColor,
                                    backgroundColor: cardColor,
                                    color: textColor,
                                },
                            ]}
                            placeholder="Confirmar contraseña"
                            placeholderTextColor={colorScheme === 'dark' ? '#9BA1A6' : '#687076'}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            autoComplete="password"
                            editable={!isLoading}
                        />

                        <Button
                            onPress={handleSignUp}
                            type={isLoading ? 'secondary' : 'primary'}
                            disabled={isLoading}
                            style={styles.button}
                        >
                            {isLoading ? 'Registrando...' : 'Registrarse'}
                        </Button>

                        <View style={styles.signInContainer}>
                            <ThemedText style={styles.signInText}>¿Ya tienes cuenta? </ThemedText>
                            <TouchableOpacity onPress={navigateToSignIn} disabled={isLoading}>
                                <ThemedText style={[styles.signInLink, { color: primaryColor }]}>
                                    Inicia sesión
                                </ThemedText>
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
    signInContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
    },
    signInText: {
        fontSize: 16,
        opacity: 0.7,
    },
    signInLink: {
        fontSize: 16,
        fontWeight: '600',
    },
});
