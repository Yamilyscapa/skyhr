import { useThemeColor } from '@/hooks/use-theme-color';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import ThemedText from './themed-text';
import Button from './ui/button';
import ThemedView from './ui/themed-view';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors and display a fallback UI
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo,
        });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
        }

        return this.props.children;
    }
}

interface ErrorFallbackProps {
    error: Error | null;
    onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
    const backgroundColor = useThemeColor({}, 'background');
    const textColor = useThemeColor({}, 'text');
    const primaryColor = useThemeColor({}, 'primary');

    return (
        <ThemedView style={[styles.container, { backgroundColor }]}>
            <View style={styles.content}>
                <ThemedText style={[styles.title, { color: textColor }]}>
                    Algo salió mal
                </ThemedText>
                <ThemedText style={[styles.message, { color: textColor }]}>
                    Ocurrió un error inesperado. Por favor, intenta nuevamente.
                </ThemedText>
                {__DEV__ && error && (
                    <View style={styles.errorDetails}>
                        <ThemedText style={[styles.errorText, { color: textColor }]}>
                            {error.toString()}
                        </ThemedText>
                        {error.stack && (
                            <ThemedText style={[styles.stackTrace, { color: textColor }]}>
                                {error.stack}
                            </ThemedText>
                        )}
                    </View>
                )}
                <Button onPress={onReset} style={styles.button}>
                    Intentar nuevamente
                </Button>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    content: {
        maxWidth: 400,
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        marginBottom: 24,
        textAlign: 'center',
        opacity: 0.8,
    },
    errorDetails: {
        width: '100%',
        marginBottom: 24,
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
    },
    errorText: {
        fontSize: 12,
        fontFamily: 'monospace',
        marginBottom: 8,
    },
    stackTrace: {
        fontSize: 10,
        fontFamily: 'monospace',
        opacity: 0.7,
    },
    button: {
        width: '100%',
    },
});

