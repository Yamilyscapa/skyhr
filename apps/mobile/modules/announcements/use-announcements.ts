import api from "@/api";
import { useCallback, useEffect, useState } from "react";
import { Announcement } from "./types";

interface UseAnnouncementsOptions {
    autoFetch?: boolean;
    cacheExpirationMs?: number; // Cache expiration time in milliseconds (default: 5 minutes)
}

interface UseAnnouncementsReturn {
    announcements: Announcement[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    fetchAnnouncements: (isRefreshing?: boolean) => Promise<void>;
    clearError: () => void;
}

// Module-level cache shared across all hook instances
interface CacheEntry {
    data: Announcement[];
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
 * Get cached announcements if available and valid
 */
function getCachedAnnouncements(expirationMs: number): Announcement[] | null {
    if (isCacheValid(expirationMs)) {
        return cache!.data;
    }
    return null;
}

/**
 * Update the cache with new announcements
 */
function updateCache(announcements: Announcement[]): void {
    cache = {
        data: announcements,
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
 * Custom hook for fetching and managing announcements
 * @param options - Configuration options
 * @param options.autoFetch - Whether to automatically fetch on mount (default: false)
 * @param options.cacheExpirationMs - Cache expiration time in milliseconds (default: 5 minutes)
 * @returns Announcements state and fetch function
 */
export function useAnnouncements(
    options: UseAnnouncementsOptions = {}
): UseAnnouncementsReturn {
    const { 
        autoFetch = false,
        cacheExpirationMs = DEFAULT_CACHE_EXPIRATION_MS,
    } = options;
    
    // Initialize state with cached data if available
    const cachedData = getCachedAnnouncements(cacheExpirationMs);
    const [announcements, setAnnouncements] = useState<Announcement[]>(cachedData || []);
    const [loading, setLoading] = useState(autoFetch && !cachedData);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAnnouncements = useCallback(async (isRefreshing = false) => {
        // Check cache first (unless refreshing, which should bypass cache)
        if (!isRefreshing) {
            const cached = getCachedAnnouncements(cacheExpirationMs);
            if (cached) {
                setAnnouncements(cached);
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

            const response = await api.getAnnouncements();
            const announcementsData = response?.data || [];
            const mappedAnnouncements = Array.isArray(announcementsData) 
                ? announcementsData.map(item => ({
                    id: item.id,
                    title: item.title,
                    content: item.content,
                    priority: item.priority,
                    createdAt: item.createdAt,
                    publishedAt: item.publishedAt,
                    expiresAt: item.expiresAt,
                    updatedAt: item.updatedAt,
                    organizationId: item.organizationId,
                })) 
                : [];
            
            // Sort by priority: urgent > important > normal
            const priorityOrder = { urgent: 0, important: 1, normal: 2 };
            const sortedAnnouncements = mappedAnnouncements.sort((a, b) => {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
            
            // Update cache and state
            updateCache(sortedAnnouncements);
            setAnnouncements(sortedAnnouncements);
        } catch (err) {
            console.error('Failed to fetch announcements', err);
            setError('No se pudieron cargar los avisos');
            
            // On error, try to use cached data if available
            const cached = getCachedAnnouncements(cacheExpirationMs);
            if (cached) {
                setAnnouncements(cached);
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
            fetchAnnouncements();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        announcements,
        loading,
        refreshing,
        error,
        fetchAnnouncements,
        clearError,
    };
}

// Export cache management functions for advanced use cases
export { clearCache };

