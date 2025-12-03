import { authClient } from '@/lib/auth-client';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

/**
 * Authentication context type
 */
interface AuthContextType {
    session: ReturnType<typeof authClient.useSession>;
    signIn: typeof authClient.signIn;
    signUp: typeof authClient.signUp;
    signOut: typeof authClient.signOut;
    activeOrganization: ReturnType<typeof authClient.useActiveOrganization>;
    organizations: ReturnType<typeof authClient.useListOrganizations>;
    createOrganization: typeof authClient.organization.create;
    updateOrganization: typeof authClient.organization.update;
    deleteOrganization: typeof authClient.organization.delete;
    setActiveOrganization: typeof authClient.organization.setActive;
    getFullOrganization: typeof authClient.organization.getFullOrganization;
    checkSlug: typeof authClient.organization.checkSlug;
    isInitialized: boolean;
}

/**
 * Authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication provider component
 * Wraps the Better Auth client and provides authentication state and methods
 * Also provides organization state and methods
 * Ensures session and organization data are loaded from SecureStore before rendering children
 */
export function AuthProvider({ children }: { children: ReactNode }) {
    const session = authClient.useSession();
    const activeOrganization = authClient.useActiveOrganization();
    const organizations = authClient.useListOrganizations();
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        // Wait for the initial session and organization data to load
        // This ensures SecureStore has been checked and organization data has been fetched before rendering
        if (!session.isPending && !activeOrganization.isPending && !organizations.isPending) {
            setIsInitialized(true);
        }
    }, [session.isPending, activeOrganization.isPending, organizations.isPending]);

    // Handle errors in session, organization queries
    useEffect(() => {
        if (session.error) {
            console.error('Session error:', session.error);
        }
        if (activeOrganization.error) {
            console.error('Active organization error:', activeOrganization.error);
        }
        if (organizations.error) {
            console.error('Organizations error:', organizations.error);
        }
    }, [session.error, activeOrganization.error, organizations.error]);

    const value: AuthContextType = {
        session,
        signIn: authClient.signIn,
        signUp: authClient.signUp,
        signOut: authClient.signOut,
        activeOrganization,
        organizations,
        createOrganization: authClient.organization.create,
        updateOrganization: authClient.organization.update,
        deleteOrganization: authClient.organization.delete,
        setActiveOrganization: authClient.organization.setActive,
        getFullOrganization: authClient.organization.getFullOrganization,
        checkSlug: authClient.organization.checkSlug,
        isInitialized,
    };

    // Show loading screen while initializing session from SecureStore
    if (!isInitialized) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
});

/**
 * Hook to access authentication context
 * @returns Authentication context with session state and auth methods
 * @throws Error if used outside of AuthProvider
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

/**
 * Hook to check if user is authenticated
 * @returns Boolean indicating if user is authenticated
 */
export function useIsAuthenticated() {
    const { session } = useAuth();
    return !!session.data?.user;
}

/**
 * Hook to get current user
 * @returns Current user object or null if not authenticated
 */
export function useUser() {
    const { session } = useAuth();
    return session.data?.user ?? null;
}

/**
 * Hook to get the active organization
 * @returns Active organization object or null if no organization is active
 */
export function useActiveOrganization() {
    const { activeOrganization } = useAuth();
    return activeOrganization ?? null;
}

/**
 * Hook to get list of organizations
 * @returns List of organizations or empty array if none found
 */
export function useOrganizations() {
    const { organizations } = useAuth();
    return organizations.data ?? [];
}

/**
 * Hook to check if user has an active organization
 * @returns Boolean indicating if user has an active organization
 */
export function useHasActiveOrganization() {
    const { activeOrganization } = useAuth();
    return !!activeOrganization.data;
}