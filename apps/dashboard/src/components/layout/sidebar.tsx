import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  LayoutDashboard,
  Users,
  CalendarCheck,
  Megaphone,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import { org } from "@/data/org";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Copilot", icon: Sparkles, exact: true },
  { to: "/overview", label: "Resumen", icon: LayoutDashboard, exact: false },
  { to: "/employees", label: "Empleados", icon: Users, exact: false },
  { to: "/attendance", label: "Asistencia", icon: CalendarCheck, exact: false },
  { to: "/announcements", label: "Anuncios", icon: Megaphone, exact: false },
  { to: "/permissions", label: "Permisos", icon: FileCheck2, exact: false },
] as const;

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <img src="/skyhr-logo.png" alt="SkyHR" className="size-8 rounded-lg object-contain" />
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">SkyHR</p>
          <p className="text-[11px] text-muted-foreground">Panel de control</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          General
        </p>
        {nav.map(({ to, label, icon: Icon, exact }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact }}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            activeProps={{
              className:
                "bg-sidebar-accent text-sidebar-accent-foreground hover:text-sidebar-accent-foreground",
            }}
          >
            <Icon className="size-4.5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mx-3 mb-4 rounded-xl border border-sidebar-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <ShieldCheck className="size-4 text-primary" />
          Plan {org.plan}
        </div>
        <div className="mt-2.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Asientos</span>
            <span className="tabular-nums">
              {org.seatsUsed}/{org.seatsTotal}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-primary")}
              style={{ width: `${(org.seatsUsed / org.seatsTotal) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
