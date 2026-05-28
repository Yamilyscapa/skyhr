import { Link } from "@tanstack/react-router";
import { Search, Bell, ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";
import { currentAdmin, org } from "@/data/org";

const mobileNav = [
  { to: "/", label: "Resumen", exact: true },
  { to: "/employees", label: "Empleados", exact: false },
  { to: "/attendance", label: "Asistencia", exact: false },
  { to: "/announcements", label: "Anuncios", exact: false },
  { to: "/permissions", label: "Permisos", exact: false },
] as const;

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 lg:hidden">
          <img src="/skyhr-logo.png" alt="SkyHR" className="size-7 rounded-md object-contain" />
          <span className="font-bold">SkyHR</span>
        </div>

        <div className="relative hidden max-w-sm flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Buscar empleados, anuncios…"
            className="h-10 w-full rounded-full border border-input bg-card pl-9 pr-3 text-sm transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button
            className="relative flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent"
            aria-label="Notificaciones"
          >
            <Bell className="size-4.5" />
            <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger ring-2 ring-card" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-accent focus:outline-none">
              <Avatar name={currentAdmin.name} size={32} />
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold">{currentAdmin.name}</p>
                <p className="text-[11px] text-muted-foreground">{org.name}</p>
              </div>
              <ChevronDown className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{currentAdmin.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Mi perfil</DropdownMenuItem>
              <DropdownMenuItem>Configuración</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger focus:text-danger">
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Mobile nav row */}
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 lg:hidden">
        {mobileNav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.exact }}
            className="whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground"
            activeProps={{ className: "bg-primary text-primary-foreground" }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
