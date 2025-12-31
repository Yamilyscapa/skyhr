import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";

interface PageLoadingContextValue {
  isPageLoading: boolean;
  setPageLoading: (loading: boolean) => void;
}

const PageLoadingContext = createContext<PageLoadingContextValue | undefined>(
  undefined,
);

export function PageLoadingProvider({ children }: { children: ReactNode }) {
  const [isPageLoading, setIsPageLoading] = useState(false);
  const router = useRouter();

  // Reset loading state when route changes
  useEffect(() => {
    setIsPageLoading(false);
  }, [router.state.location.pathname]);

  return (
    <PageLoadingContext.Provider
      value={{
        isPageLoading,
        setPageLoading: setIsPageLoading,
      }}
    >
      {children}
    </PageLoadingContext.Provider>
  );
}

export function usePageLoading() {
  const context = useContext(PageLoadingContext);
  if (context === undefined) {
    throw new Error(
      "usePageLoading must be used within a PageLoadingProvider",
    );
  }
  return context;
}


