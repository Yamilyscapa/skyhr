import {
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
  MapPinOff,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AttendanceStatus,
  PermissionStatus,
  AnnouncementPriority,
  AnnouncementStatus,
  EmployeeStatus,
} from "@/data/types";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "outline";

const toneText: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-muted-foreground",
  outline: "text-foreground",
};

const toneVar: Record<Tone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--muted-foreground)",
  outline: "var(--border)",
};

type Size = "sm" | "md";

const sizeStyles: Record<Size, string> = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

const iconSize: Record<Size, string> = {
  sm: "size-3",
  md: "size-3.5",
};

export function Pill({
  tone,
  icon: Icon,
  label,
  size = "md",
  className,
}: {
  tone: Tone;
  icon?: LucideIcon;
  label: string;
  size?: Size;
  className?: string;
}) {
  const v = toneVar[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap ring-1 ring-inset",
        toneText[tone],
        sizeStyles[size],
        className,
      )}
      style={{
        backgroundColor:
          tone === "outline"
            ? "transparent"
            : `color-mix(in oklch, ${v} 18%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${v} 28%, transparent)`,
      }}
    >
      {Icon && <Icon className={iconSize[size]} />}
      {label}
    </span>
  );
}

const attendanceMap: Record<
  AttendanceStatus,
  { tone: Tone; icon: LucideIcon; label: string }
> = {
  on_time: { tone: "success", icon: CheckCircle2, label: "A tiempo" },
  late: { tone: "warning", icon: Clock, label: "Tarde" },
  early: { tone: "info", icon: CheckCircle2, label: "Anticipado" },
  absent: { tone: "danger", icon: XCircle, label: "Ausente" },
  out_of_bounds: { tone: "danger", icon: MapPinOff, label: "Fuera de zona" },
};

export function AttendanceBadge({
  status,
  size = "md",
  className,
}: {
  status: AttendanceStatus | "off";
  size?: Size;
  className?: string;
}) {
  if (status === "off") {
    return (
      <Pill
        tone="neutral"
        icon={CircleDashed}
        label="Sin turno"
        size={size}
        className={className}
      />
    );
  }
  const c = attendanceMap[status];
  return (
    <Pill
      tone={c.tone}
      icon={c.icon}
      label={c.label}
      size={size}
      className={className}
    />
  );
}

const permissionMap: Record<
  PermissionStatus,
  { tone: Tone; icon: LucideIcon; label: string }
> = {
  pending: { tone: "warning", icon: Clock, label: "Pendiente" },
  approved: { tone: "success", icon: CheckCircle2, label: "Aprobado" },
  rejected: { tone: "danger", icon: XCircle, label: "Rechazado" },
};

export function PermissionBadge({
  status,
  size = "md",
  className,
}: {
  status: PermissionStatus;
  size?: Size;
  className?: string;
}) {
  const c = permissionMap[status];
  return (
    <Pill
      tone={c.tone}
      icon={c.icon}
      label={c.label}
      size={size}
      className={className}
    />
  );
}

const priorityMap: Record<
  AnnouncementPriority,
  { tone: Tone; icon: LucideIcon; label: string }
> = {
  normal: { tone: "info", icon: CircleDashed, label: "Normal" },
  important: { tone: "warning", icon: Clock, label: "Importante" },
  urgent: { tone: "danger", icon: Ban, label: "Urgente" },
};

export function PriorityBadge({
  priority,
  size = "md",
  className,
}: {
  priority: AnnouncementPriority;
  size?: Size;
  className?: string;
}) {
  const c = priorityMap[priority];
  return (
    <Pill
      tone={c.tone}
      icon={c.icon}
      label={c.label}
      size={size}
      className={className}
    />
  );
}

const announcementStatusMap: Record<
  AnnouncementStatus,
  { tone: Tone; label: string }
> = {
  active: { tone: "success", label: "Activo" },
  future: { tone: "info", label: "Programado" },
  expired: { tone: "neutral", label: "Expirado" },
};

export function AnnouncementStatusBadge({
  status,
  size = "md",
  className,
}: {
  status: AnnouncementStatus;
  size?: Size;
  className?: string;
}) {
  const c = announcementStatusMap[status];
  return <Pill tone={c.tone} label={c.label} size={size} className={className} />;
}

export function EmployeeStatusBadge({
  status,
  size = "md",
  className,
}: {
  status: EmployeeStatus;
  size?: Size;
  className?: string;
}) {
  if (status === "pending") {
    return (
      <Pill
        tone="warning"
        icon={Clock}
        label="Pendiente"
        size={size}
        className={className}
      />
    );
  }
  return (
    <Pill
      tone="success"
      icon={CheckCircle2}
      label="Activo"
      size={size}
      className={className}
    />
  );
}
