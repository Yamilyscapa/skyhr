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
import { useCommandPalette } from "./command-palette";
import { currentAdmin, org } from "@/data/org";

const mobileNav = [
  { to: "/", label: "Copilot", exact: true },
  { to: "/overview", label: "Resumen", exact: false },
  { to: "/employees", label: "Empleados", exact: false },
  { to: "/attendance", label: "Asistencia", exact: false },
  { to: "/schedules", label: "Horarios", exact: false },
  { to: "/announcements", label: "Anuncios", exact: false },
  { to: "/permissions", label: "Permisos", exact: false },
] as const;

export function Topbar() {
  const { open } = useCommandPalette();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2.5 lg:hidden">
          <img src="/skyhr-logo.png" alt="SkyHR" className="size-7 rounded-md object-contain" />
          <span className="font-bold">SkyHR</span>
        </div>

        <button
          onClick={open}
          className="relative hidden max-w-sm flex-1 items-center gap-2 rounded-full border border-input bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent sm:flex"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate">Buscar o preguntar a SkyHR…</span>
          <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium md:inline-flex">
            ⌘K
          </kbd>
        </button>

        {/* Mobile: icon-only palette trigger */}
        <button
          onClick={open}
          aria-label="Buscar"
          className="ml-auto flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-accent sm:hidden sm:ml-0"
        >
          <Search className="size-4.5" />
        </button>

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
