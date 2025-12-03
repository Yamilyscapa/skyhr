import api from "@/api";
import { useCallback, useEffect, useState } from "react";
import { Permission } from "./types";

interface UsePermissionsOptions {
    autoFetch?: boolean;
    cacheExpirationMs?: number; // Cache expiration time in milliseconds (default: 5 minutes)
}

interface UsePermissionsReturn {
    permissions: Permission[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    fetchPermissions: (isRefreshing?: boolean, filters?: { status?: string; userId?: string }) => Promise<void>;
    clearError: () => void;
}

// Module-level cache shared across all hook instances
interface CacheEntry {
    data: Permission[];
    timestamp: number;
}

let cache: CacheEntry | null = null;
const DEFAULT_CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if the cache is valid (exists and hasn't expired)
 */
function isCacheValid(expirationMs: number): boolean {
    if (!cache) {
        return false;
    }
    const now = Date.now();
    return (now - cache.timestamp) < expirationMs;
}

/**
 * Get cached permissions if available and valid
 */
function getCachedPermissions(expirationMs: number): Permission[] | null {
    if (isCacheValid(expirationMs)) {
        return cache!.data;
    }
    return null;
}

/**
 * Update the cache with new permissions
 */
function updateCache(permissions: Permission[]): void {
    cache = {
        data: permissions,
        timestamp: Date.now(),
    };
}

/**
 * Clear the cache
 */
function clearCache(): void {
    cache = null;
}

/**
 * Custom hook for fetching and managing permissions
 * @param options - Configuration options
 * @param options.autoFetch - Whether to automatically fetch on mount (default: false)
 * @param options.cacheExpirationMs - Cache expiration time in milliseconds (default: 5 minutes)
 * @returns Permissions state and fetch function
 */
export function usePermissions(
    options: UsePermissionsOptions = {}
): UsePermissionsReturn {
    const { 
        autoFetch = false,
        cacheExpirationMs = DEFAULT_CACHE_EXPIRATION_MS,
    } = options;
    
    // Initialize state with cached data if available
    const cachedData = getCachedPermissions(cacheExpirationMs);
    const [permissions, setPermissions] = useState<Permission[]>(cachedData || []);
    const [loading, setLoading] = useState(autoFetch && !cachedData);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPermissions = useCallback(async (isRefreshing = false, filters?: { status?: string; userId?: string }) => {
        // Check cache first (unless refreshing, which should bypass cache)
        // Only use cache when no filters are provided (filters would change the result)
        if (!isRefreshing && !filters) {
            const cached = getCachedPermissions(cacheExpirationMs);
            if (cached) {
                setPermissions(cached);
                setLoading(false);
                return;
            }
        }

        try {
            if (isRefreshing) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            setError(null);

            const response = await api.getPermissions(filters);
            const permissionsData = response?.data || [];
            const mappedPermissions = Array.isArray(permissionsData) 
                ? permissionsData.map(item => ({
                    id: item.id,
                    userId: item.userId,
                    organizationId: item.organizationId,
                    message: item.message,
                    documentsUrl: item.documentsUrl || [],
                    startingDate: item.startingDate,
                    endDate: item.endDate,
                    status: item.status,
                    approvedBy: item.approvedBy,
                    supervisorComment: item.supervisorComment,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                })) 
                : [];
            
            // Sort by created date (newest first)
            const sortedPermissions = mappedPermissions.sort((a, b) => {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });
            
            // Only update cache when no filters are provided (filters would change the result)
            if (!filters) {
                updateCache(sortedPermissions);
            }
            setPermissions(sortedPermissions);
        } catch (err) {
            console.error('Failed to fetch permissions', err);
            setError('No se pudieron cargar los permisos');
            
            // On error, try to use cached data if available (only if no filters)
            if (!filters) {
                const cached = getCachedPermissions(cacheExpirationMs);
                if (cached) {
                    setPermissions(cached);
                }
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [cacheExpirationMs]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Auto-fetch on mount if enabled
    useEffect(() => {
        if (autoFetch) {
            fetchPermissions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        permissions,
        loading,
        refreshing,
        error,
        fetchPermissions,
        clearError,
    };
}

// Export cache management functions for advanced use cases
export { clearCache };

