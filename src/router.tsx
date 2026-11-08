import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes: cache data to prevent constant refetching
        gcTime: 1000 * 60 * 15, // 15 minutes: keep unused cache in memory
        refetchOnWindowFocus: false, // Prevents repetitive network round-trips over Cloudflare Tunnel on tab switch
        retry: 1, // Fast failure recovery
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 1000 * 60 * 2,
  });

  return router;
};
