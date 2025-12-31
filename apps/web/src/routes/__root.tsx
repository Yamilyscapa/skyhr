import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouter,
  Link,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useUserStore } from "@/store/user-store";
import {
  useOrganizationStore,
  attachCurrentMemberData,
} from "@/store/organization-store";
import type { User } from "@/store/user-store";
import type { Organization } from "@/store/organization-store";
import { useEffect } from "react";
import { useAuthData } from "@/hooks/use-auth-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "skyhr",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/png",
        href: "/sky-logo.png",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
  // No loader - using React Query for data fetching with caching
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  
  // Routes that don't need sidebar or auth data
  const routesWithoutSidebar = [
    "/login",
    "/signup",
    "/create-organization",
    "/accept-invitation",
    "/getting-started",
  ];
  
  const showSidebar = !routesWithoutSidebar.includes(
    router.state.location.pathname,
  );
  
  // Skip auth data fetching for auth routes (Option 3)
  const isAuthRoute = routesWithoutSidebar.includes(
    router.state.location.pathname,
  );

  // Sync with Zustand stores
  const { setUser } = useUserStore();
  const { setOrganization } = useOrganizationStore();

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {!isAuthRoute && (
          <AuthDataSynchronizer
            setUser={setUser}
            setOrganization={setOrganization}
          />
        )}
        {showSidebar ? (
          <SidebarProvider>
            <AppSidebar />
            <div className="flex-1">
              <div className="flex items-center gap-2 p-4">
                <SidebarTrigger data-sidebar="trigger" />
              </div>
              {children}
            </div>
          </SidebarProvider>
        ) : (
          <div className="flex-1">{children}</div>
        )}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function AuthDataSynchronizer({
  setUser,
  setOrganization,
}: {
  setUser: (user: User | null) => void;
  setOrganization: (organization: Organization | null) => void;
}) {
  const { user, organization } = useAuthData();

  useEffect(() => {
    setUser(user ?? null);
    const enrichedOrganization = attachCurrentMemberData(organization ?? null, user);
    setOrganization(enrichedOrganization);
  }, [user, organization, setUser, setOrganization]);

  return null;
}

function NotFoundComponent() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <span className="text-3xl font-bold text-muted-foreground">404</span>
          </div>
          <CardTitle className="text-2xl">Página no encontrada</CardTitle>
          <CardDescription>
            Lo sentimos, la página que estás buscando no existe o ha sido movida.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link to="/">Ir al inicio</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => router.history.back()}
            className="w-full"
          >
            Volver atrás
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function RootErrorComponent({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <span className="text-3xl font-bold text-muted-foreground">!</span>
          </div>
          <CardTitle className="text-2xl">Algo salió mal</CardTitle>
          <CardDescription>
            Ocurrió un problema inesperado. Puedes intentar recargar la vista.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={reset} className="w-full">
            Reintentar
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Ir al inicio</Link>
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.history.back()}
            className="w-full"
          >
            Volver atrás
          </Button>
          {import.meta.env.DEV && (
            <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
