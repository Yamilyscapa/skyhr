import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { fetchLocations } from "../data";
import type { Location } from "../types";

export const LOCATIONS_QUERY_KEY = ["locations"] as const;

export function useLocations(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  const locationsQuery = useQuery<Location[]>({
    queryKey: [...LOCATIONS_QUERY_KEY, organizationId],
    queryFn: async ({ signal }) => {
      if (!organizationId) {
        return [];
      }

      // Check if already aborted before starting
      if (signal?.aborted) {
        throw new DOMException("Query was aborted", "AbortError");
      }

      // Return basic location data immediately
      const locations = await fetchLocations(organizationId);

      // Final check before returning
      if (signal?.aborted) {
        throw new DOMException("Query was aborted", "AbortError");
      }

      return locations;
    },
    enabled: !!organizationId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Enrich locations with additional data in the background (incrementally)
  // This structure allows for future enrichment (e.g., user counts, statistics, etc.)
  useEffect(() => {
    const locations = locationsQuery.data;
    if (!locations || locations.length === 0) return;

    // Create an abort controller for background enrichment
    const abortController = new AbortController();
    const signal = abortController.signal;

    // Track which locations have already been enriched to avoid duplicate work
    const enrichedIds = new Set<string>();

    // Helper function to update a single location in the cache
    const updateLocationInCache = (
      locationId: string,
      enrichedData: Partial<Location>,
    ) => {
      if (signal.aborted) return;

      queryClient.setQueryData<Location[]>(
        [...LOCATIONS_QUERY_KEY, organizationId],
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.map((loc) =>
            loc.id === locationId ? { ...loc, ...enrichedData } : loc
          );
        },
      );
    };

    // Enrich each location individually and update cache incrementally
    // Currently, locations come with all their data, but this structure
    // allows for future enrichment (e.g., user assignment counts, statistics, etc.)
    const enrichLocation = async (location: Location) => {
      if (!location.id || enrichedIds.has(location.id) || signal.aborted) return;

      // Skip if already has all enrichment data
      // Add conditions here for any future enrichment data
      // For now, we just mark it as processed
      enrichedIds.add(location.id);

      // Future: Add enrichment logic here if needed
      // Example: fetch user assignment count, statistics, etc.
      // const enrichedData: Partial<Location> = {};
      // updateLocationInCache(location.id, enrichedData);
    };

    // Enrich all locations in parallel, but update cache incrementally
    // This allows the UI to update as each location's data loads
    void Promise.all(locations.map((location) => enrichLocation(location)));

    // Cleanup: abort if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [locationsQuery.data, organizationId, queryClient]);

  return locationsQuery;
}

