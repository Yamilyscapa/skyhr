import { useRef } from "react";
import { LogOutIcon, UserIcon, Settings } from "lucide-react";
import { useRouter, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "@/store/user-store";
import { useOrganizationStore } from "@/store/organization-store";
import { Button } from "@/components/ui/button";
import { usePageLoading } from "@/contexts/page-loading-context";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { logout } from "@/lib/auth";

const data = {
  navMain: [
    {
      title: "Inicio",
      url: "/",
    },
    {
      title: "Gestionar personas",
      url: "#",
      items: [
        {
          title: "Empleados",
          url: "/employees",
        },
        {
          title: "Visitantes",
          url: "/visitors",
        },
        {
          title: "Gestionar asistencia",
          url: "/attendance",
        },
        {
          title: "Gestionar permisos",
          url: "/permissions",
        },  
      ],
    },
    {
      title: "Organizacion",
      url: "#",
      items: [
        {
          title: "Sucursales",
          url: "/locations",
        },
        {
          title: "Horarios",
          url: "/schedules",
        },
        {
          title: "Anuncios",
          url: "/announcements",
        },
        // {
        //   title: "Gestionar permisos",
        //   url: "#",
        // },
        // {
        //   title: "Reportes",
        //   url: "#",
        // },
      ],
    },
  ],
};

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  loading?: boolean;
};

export function AppSidebar({ loading = false, ...props }: AppSidebarProps) {
  const { organization } = useOrganizationStore();
  const { user } = useUserStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isPageLoading } = usePageLoading();
  const lastNavTimestampRef = useRef<number | null>(null);

  if (!organization) {
    return loading ? (
      <Sidebar variant="floating" {...props}>
        <SidebarHeader className="relative">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu className="gap-2">
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                  <SidebarMenuSubItem>
                    <SidebarMenuSkeleton />
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSkeleton />
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
                <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                  <SidebarMenuSubItem>
                    <SidebarMenuSkeleton />
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSkeleton />
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="size-8 rounded-lg" />
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    ) : null;
  }

  const currentPath = router.state.location.pathname;
  const slug = organization?.slug ?? "";
  const basePath = slug ? `/${slug}` : "/";

  const resolvePath = (url: string) => {
    if (url === "#") {
      return "#";
    }

    if (!slug) {
      return url;
    }

    if (url === "/") {
      return basePath;
    }

    return `${basePath}${url.startsWith("/") ? url : `/${url}`}`;
  };

  // Check if a URL matches the current path
  const isActive = (url: string) => {
    if (url === "#") return false;
    const resolved = resolvePath(url);
    if (resolved === "#") {
      return false;
    }
    if (url === "/") {
      return currentPath === resolved;
    }
    return currentPath.startsWith(resolved);
  };

  // Check if any child item is active (for parent menu items)
  const hasActiveChild = (items?: Array<{ url: string }>) => {
    if (!items) return false;
    return items.some((child) => isActive(child.url));
  };

  const normalizePath = (path: string) =>
    path === "/" ? path : path.replace(/\/+$/, "");

  const createNavHandler =
    (target: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Block navigation if page is loading
      if (isPageLoading) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (!target || target === "#") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Prevent navigation to the same path
      if (normalizePath(currentPath) === normalizePath(target)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Global navigation lock: prevent ANY navigation within 200ms of the last navigation
      const now = Date.now();
      const lastNavTimestamp = lastNavTimestampRef.current;
      if (lastNavTimestamp && now - lastNavTimestamp < 200) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      // Cancel all pending queries when navigating to prevent state updates after unmount
      queryClient.cancelQueries();

      // Update the ref with the new navigation timestamp
      lastNavTimestampRef.current = now;
    };

  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader className="relative">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild disabled={isPageLoading}>
              <Link 
                to={resolvePath("/")}
                className={isPageLoading ? "pointer-events-none opacity-50 cursor-not-allowed" : ""}
                onClick={createNavHandler(resolvePath("/"))}
              >
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img
                    src="/sky-logo.png"
                    alt="Sky HR"
                    className="size-8 rounded-lg"
                  />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">{organization?.name}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <button
          className="absolute top-4 right-4 z-50 flex h-8 w-8 items-center justify-center rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          onClick={() => {
            // Toggle sidebar by clicking the document's sidebar trigger
            const trigger = document.querySelector(
              '[data-sidebar="trigger"]',
            ) as HTMLElement;
            if (trigger) {
              trigger.click();
            }
          }}
        ></button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            {data.navMain.map((item) => (
              <SidebarMenuItem key={item.title}>
                {item.url === "#" ? (
                  <SidebarMenuButton
                    type="button"
                    isActive={hasActiveChild(item.items)}
                    className="font-medium"
                    disabled={isPageLoading}
                  >
                    {item.title}
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url) || hasActiveChild(item.items)}
                    disabled={isPageLoading}
                  >
                    <Link
                      to={resolvePath(item.url)}
                      className={`font-medium ${isPageLoading ? "pointer-events-none opacity-50 cursor-not-allowed" : ""}`}
                      preload={false}
                      onClick={createNavHandler(resolvePath(item.url))}
                    >
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                )}
                {item.items?.length ? (
                  <SidebarMenuSub className="ml-0 border-l-0 px-1.5">
                    {item.items.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton
                          asChild
                          isActive={isActive(subItem.url)}
                          disabled={isPageLoading}
                        >
                          <Link
                            to={resolvePath(subItem.url)}
                            preload={false}
                            className={isPageLoading ? "pointer-events-none opacity-50 cursor-not-allowed" : ""}
                            onClick={createNavHandler(resolvePath(subItem.url))}
                          >
                            {subItem.title}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton size="lg" asChild disabled={isPageLoading}>
                    <Link 
                      to={resolvePath("/settings")} 
                      className={`flex items-center gap-2 ${isPageLoading ? "pointer-events-none opacity-50 cursor-not-allowed" : ""}`}
                      onClick={createNavHandler(resolvePath("/settings"))}
                    >
                      <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                        <UserIcon className="size-4" />
                      </div>
                      <div className="flex flex-col gap-0.5 leading-none">
                        <span className="font-medium">{user?.name}</span>
                        <span className="text-xs text-sidebar-foreground/70">
                          {user?.email}
                        </span>
                      </div>
                    </Link>
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right" className="w-52 p-2">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-full justify-start flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent ${isPageLoading ? "pointer-events-none opacity-50 cursor-not-allowed" : ""}`}
                      asChild
                      disabled={isPageLoading}
                    >
                      <Link 
                        to={resolvePath("/settings")}
                        onClick={createNavHandler(resolvePath("/settings"))}
                      >
                        <Settings className="size-4" />
                        <span className="text-sm">Configuración</span>
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => logout()}
                      className="w-full justify-start flex items-center gap-2 rounded-md px-2 py-1.5 text-red-600 hover:text-red-700 hover:bg-red-600/10"
                    >
                      <LogOutIcon className="size-4" />
                      <span className="text-sm">Cerrar sesión</span>
                    </Button>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
