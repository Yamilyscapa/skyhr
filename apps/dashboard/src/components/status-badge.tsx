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

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneStyles: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-muted-foreground",
};

const toneVar: Record<Tone, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
  neutral: "var(--muted-foreground)",
};

function Pill({
  tone,
  icon: Icon,
  label,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        toneStyles[tone],
      )}
      style={{ backgroundColor: `color-mix(in srgb, ${toneVar[tone]} 14%, transparent)` }}
    >
      <Icon className="size-3.5" />
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

export function AttendanceBadge({ status }: { status: AttendanceStatus | "off" }) {
  if (status === "off") {
    return <Pill tone="neutral" icon={CircleDashed} label="Sin turno" />;
  }
  const c = attendanceMap[status];
  return <Pill tone={c.tone} icon={c.icon} label={c.label} />;
}

const permissionMap: Record<
  PermissionStatus,
  { tone: Tone; icon: LucideIcon; label: string }
> = {
  pending: { tone: "warning", icon: Clock, label: "Pendiente" },
  approved: { tone: "success", icon: CheckCircle2, label: "Aprobado" },
  rejected: { tone: "danger", icon: XCircle, label: "Rechazado" },
};

export function PermissionBadge({ status }: { status: PermissionStatus }) {
  const c = permissionMap[status];
  return <Pill tone={c.tone} icon={c.icon} label={c.label} />;
}

const priorityMap: Record<
  AnnouncementPriority,
  { tone: Tone; icon: LucideIcon; label: string }
> = {
  normal: { tone: "info", icon: CircleDashed, label: "Normal" },
  important: { tone: "warning", icon: Clock, label: "Importante" },
  urgent: { tone: "danger", icon: Ban, label: "Urgente" },
};

export function PriorityBadge({ priority }: { priority: AnnouncementPriority }) {
  const c = priorityMap[priority];
  return <Pill tone={c.tone} icon={c.icon} label={c.label} />;
}

const announcementStatusMap: Record<AnnouncementStatus, { tone: Tone; label: string }> = {
  active: { tone: "success", label: "Activo" },
  future: { tone: "info", label: "Programado" },
  expired: { tone: "neutral", label: "Expirado" },
};

export function AnnouncementStatusBadge({ status }: { status: AnnouncementStatus }) {
  const c = announcementStatusMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneStyles[c.tone],
      )}
      style={{ backgroundColor: `color-mix(in srgb, ${toneVar[c.tone]} 14%, transparent)` }}
    >
      {c.label}
    </span>
  );
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  if (status === "pending") {
    return <Pill tone="warning" icon={Clock} label="Invitación pendiente" />;
  }
  return <Pill tone="success" icon={CheckCircle2} label="Activo" />;
}
