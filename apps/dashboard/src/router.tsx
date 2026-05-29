import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // HR data isn't second-to-second critical; 60s keeps it fresh enough
        // while serving instant cached reads on navigation.
        staleTime: 60_000,
        retry: 1,
      },
    },
  });

  const router = createTanstackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // Let React Query own cache freshness; don't double-cache in the router.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  });

  return routerWithQueryClient(router, queryClient);
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
