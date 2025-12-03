import * as Location from 'expo-location';
import { createContext, createElement, ReactNode, useContext, useEffect, useRef, useState } from 'react';

const LOCATION_ACCURACY = Location.Accuracy.Balanced;

type LocationContextValue = {
    location: Location.LocationObject | null;
    hasPermission: boolean;
    isLoading: boolean;
    error: string | null;
    refreshLocation: () => Promise<Location.LocationObject | null>;
    latitude?: string;
    longitude?: string;
};

const LocationContext = createContext<LocationContextValue | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
    const value = useProvideLocation();
    return createElement(LocationContext.Provider, { value }, children);
}

export function useLocation() {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
}

function useProvideLocation(): LocationContextValue {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [hasPermission, setHasPermission] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const watcherRef = useRef<Location.LocationSubscription | null>(null);

    const log = (...args: unknown[]) => console.debug('[useLocation]', ...args);

    useEffect(() => {
        let isMounted = true;

        const initializeLocationWatcher = async () => {
            setIsLoading(true);
            log('Requesting foreground location permissions');

            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                const granted = status === 'granted';
                setHasPermission(granted);

                if (!granted) {
                    log('Location permission denied');
                    setError('Location permission not granted');
                    return;
                }

                log('Permission granted, fetching last known position');
                const lastKnown = await Location.getLastKnownPositionAsync();
                if (lastKnown && isMounted) {
                    log('Last known position found');
                    setLocation(lastKnown);
                }

                const fetchFreshLocation = async () => {
                    try {
                        log('Requesting fresh location fix');
                        const currentLocation = await Location.getCurrentPositionAsync({
                            accuracy: LOCATION_ACCURACY,
                        });
                        if (isMounted) {
                            log('Fresh location fix received');
                            setLocation(currentLocation);
                            setError(null);
                        }
                    } catch (freshErr) {
                        const message = freshErr instanceof Error ? freshErr.message : 'Failed to get location';
                        log('Error requesting fresh location fix:', message);
                        if (isMounted) {
                            setError(message);
                        }
                    }
                };

                await fetchFreshLocation();

                if (isMounted) {
                    log('Initial location setup finished');
                    setIsLoading(false);
                }

                log('Starting location watcher');
                watcherRef.current = await Location.watchPositionAsync(
                    {
                        accuracy: LOCATION_ACCURACY,
                        distanceInterval: 5,
                        timeInterval: 4000,
                    },
                    (position) => {
                        log('Location update received');
                        if (isMounted) {
                            setLocation(position);
                            setError(null);
                        }
                    }
                );
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to get location';
                log('Failed to initialize location watcher:', message);
                if (isMounted) {
                    setError(message);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        initializeLocationWatcher();

        return () => {
            isMounted = false;
            log('Cleaning up location watcher');
            watcherRef.current?.remove();
            watcherRef.current = null;
        };
    }, []);

    const refreshLocation = async () => {
        if (!hasPermission) {
            setError('Location permission not granted');
            return null;
        }

        try {
            setIsLoading(true);
            setError(null);
            log('Manual location refresh requested');
            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: LOCATION_ACCURACY,
            });
            setLocation(currentLocation);
            return currentLocation;
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to get location';
            setError(errorMsg);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        location,
        hasPermission,
        isLoading,
        error,
        refreshLocation,
        latitude: location?.coords.latitude.toString(),
        longitude: location?.coords.longitude.toString(),
    };
}
