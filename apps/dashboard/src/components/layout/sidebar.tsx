import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarClock,
  Megaphone,
  FileCheck2,
  DoorOpen,
  MapPin,
  Wallet,
  CreditCard,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { api, type OrganizationOverview } from "@/lib/api";

const sections = [
  {
    label: "General",
    items: [
      { to: "/", label: "Copilot", icon: Sparkles, exact: true },
      { to: "/overview", label: "Resumen", icon: LayoutDashboard, exact: false },
    ],
  },
  {
    label: "Personal",
    items: [
      { to: "/employees", label: "Empleados", icon: Users, exact: false },
      { to: "/attendance", label: "Asistencia", icon: CalendarCheck, exact: false },
      { to: "/schedules", label: "Horarios", icon: CalendarClock, exact: false },
      { to: "/permissions", label: "Permisos", icon: FileCheck2, exact: false },
      { to: "/payroll", label: "Nómina", icon: Wallet, exact: false },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { to: "/announcements", label: "Anuncios", icon: Megaphone, exact: false },
      { to: "/visitors", label: "Visitantes", icon: DoorOpen, exact: false },
      { to: "/locations", label: "Geocercas", icon: MapPin, exact: false },
    ],
  },
  {
    label: "Organización",
    items: [
      { to: "/billing", label: "Facturación", icon: CreditCard, exact: false },
      { to: "/settings", label: "Configuración", icon: Settings, exact: false },
    ],
  },
] as const;

export function Sidebar() {
  const [org, setOrg] = useState<OrganizationOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.organizations
      .me()
      .then((o) => {
        if (!cancelled) setOrg(o);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const seatsPct =
    org && org.seatsTotal > 0
      ? Math.min(100, (org.seatsUsed / org.seatsTotal) * 100)
      : 0;

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <img src="/skyhr-logo.png" alt="SkyHR" className="size-8 rounded-lg object-contain" />
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight">SkyHR</p>
          <p className="text-[11px] text-muted-foreground">Panel de control</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {sections.map((section) => (
          <div key={section.label} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.label}
            </p>
            {section.items.map(({ to, label, icon: Icon, exact }) => (
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
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-4 rounded-xl border border-sidebar-border bg-card p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <ShieldCheck className="size-4 text-primary" />
          Plan {org?.plan ?? "—"}
        </div>
        <div className="mt-2.5">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Asientos</span>
            <span className="tabular-nums">
              {org?.seatsUsed ?? 0}/{org?.seatsTotal ?? 0}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full bg-primary")}
              style={{ width: `${seatsPct}%` }}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
