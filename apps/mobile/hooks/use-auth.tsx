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
    const [isInitialized, setIsInitialized] = useState(false);
    
    // Always call hooks - they must be called unconditionally
    const session = authClient.useSession();
    const activeOrganization = authClient.useActiveOrganization();
    const organizations = authClient.useListOrganizations();

    useEffect(() => {
        // Wait for the initial session and organization data to load
        // This ensures SecureStore has been checked and organization data has been fetched before rendering
        // Add timeout to prevent infinite loading if API is unreachable
        // Shorter timeout in production to avoid blocking the UI
        const timeout = setTimeout(() => {
            console.warn('Auth initialization timeout - proceeding anyway');
            setIsInitialized(true);
        }, 3000); // 3 second timeout - don't block UI for too long

        if (!session.isPending && !activeOrganization.isPending && !organizations.isPending) {
            clearTimeout(timeout);
            setIsInitialized(true);
        }

        return () => clearTimeout(timeout);
    }, [session.isPending, activeOrganization.isPending, organizations.isPending]);

    // Handle errors in session, organization queries
    // Don't block initialization on errors - allow app to continue
    // 401 errors are expected for unauthenticated users and should not be logged as errors
    useEffect(() => {
        const isAuthenticated = !!session.data?.user;
        
        if (session.error) {
            console.error('Session error:', session.error);
            // Still allow initialization even if there's an error
            if (session.isPending === false) {
                setIsInitialized(true);
            }
        }
        
        // 401 errors are expected when user is not logged in - use debug logging
        if (activeOrganization.error) {
            const isUnauthorized = activeOrganization.error?.status === 401;
            if (isUnauthorized && !isAuthenticated) {
                // Expected behavior for unauthenticated users - log at debug level
                console.debug('Active organization: user not authenticated (401)');
            } else {
                // Actual error - log as error
                console.error('Active organization error:', activeOrganization.error);
            }
        }
        
        // 401 errors are expected when user is not logged in - use debug logging
        if (organizations.error) {
            const isUnauthorized = organizations.error?.status === 401;
            if (isUnauthorized && !isAuthenticated) {
                // Expected behavior for unauthenticated users - log at debug level
                console.debug('Organizations: user not authenticated (401)');
            } else {
                // Actual error - log as error
                console.error('Organizations error:', organizations.error);
            }
        }
    }, [session.error, activeOrganization.error, organizations.error, session.isPending, session.data?.user]);

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

    // Show minimal loading state if needed, but don't block
    // The native splash should already be hidden by RootLayout
    // This is just a fallback in case auth takes longer
    if (!isInitialized) {
        // Return children anyway - don't block the app
        // Auth will initialize in the background
        return (
            <AuthContext.Provider value={value}>
                {children}
            </AuthContext.Provider>
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