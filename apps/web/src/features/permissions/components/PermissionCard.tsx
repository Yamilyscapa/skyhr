import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CheckCircle2,
  Clock,
  XCircle,
  Calendar,
  Paperclip,
  Eye,
  Check,
  X,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Permission } from "../types";
import { UserInfo } from "../utils";
import { cn } from "@/lib/utils";

interface PermissionCardProps {
  permission: Permission;
  user?: UserInfo;
  onView: (permission: Permission) => void;
  onApprove?: (permission: Permission) => void;
  onReject?: (permission: Permission) => void;
  onAddDocuments?: (permission: Permission) => void;
  canManage?: boolean;
}

export function PermissionCard({
  permission,
  user,
  onView,
  onApprove,
  onReject,
  onAddDocuments,
  canManage,
}: PermissionCardProps) {
  const getStatusConfig = (status: Permission["status"]) => {
    switch (status) {
      case "approved":
        return {
          color: "text-emerald-600 dark:text-emerald-500",
          bgColor: "bg-emerald-100 dark:bg-emerald-950/50",
          icon: CheckCircle2,
          label: "Aprobado",
        };
      case "rejected":
        return {
          color: "text-red-600 dark:text-red-500",
          bgColor: "bg-red-100 dark:bg-red-950/50",
          icon: XCircle,
          label: "Rechazado",
        };
      case "pending":
      default:
        return {
          color: "text-amber-600 dark:text-amber-500",
          bgColor: "bg-amber-100 dark:bg-amber-950/50",
          icon: Clock,
          label: "Pendiente",
        };
    }
  };

  const statusConfig = getStatusConfig(permission.status);
  const StatusIcon = statusConfig.icon;

  const formatDateRange = (start: string, end: string) => {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      return `${format(startDate, "d MMM", { locale: es })} - ${format(endDate, "d MMM yyyy", { locale: es })}`;
    } catch {
      return "Fecha inválida";
    }
  };

  const isPending = permission.status === "pending";

  return (
    <Card className="flex flex-col gap-4 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-full", statusConfig.bgColor)}>
            <StatusIcon className={cn("size-6", statusConfig.color)} />
          </div>
          <div>
            <div
              className={cn(
                "text-sm font-semibold px-2.5 py-0.5 rounded-full inline-flex",
                statusConfig.bgColor,
                statusConfig.color,
              )}
            >
              {statusConfig.label}
            </div>
            {user && (
              <div className="text-sm font-medium mt-1">{user.name}</div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onView(permission)}
            title="Ver detalles"
          >
            <Eye className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="size-4 opacity-70" />
          <span className="text-sm font-semibold">
            {formatDateRange(permission.startingDate, permission.endDate)}
          </span>
        </div>

        <p className="text-sm line-clamp-2">{permission.message}</p>

        {permission.documentsUrl && permission.documentsUrl.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Paperclip className="size-4 opacity-70" />
            <span>
              {permission.documentsUrl.length} documento
              {permission.documentsUrl.length > 1 ? "s" : ""}
            </span>
          </div>
        )}

        {permission.supervisorComment && (
          <div className="bg-muted/50 p-3 rounded-lg border text-sm mt-2">
            <div className="font-semibold mb-1 opacity-80">
              Comentario del supervisor:
            </div>
            <p>{permission.supervisorComment}</p>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Creado:{" "}
          {format(new Date(permission.createdAt), "d MMM yyyy", { locale: es })}
        </div>

        <div className="flex items-center gap-2">
          {isPending && onAddDocuments && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddDocuments(permission)}
            >
              <Plus className="size-4 mr-1" /> Documentos
            </Button>
          )}
          {isPending && canManage && onApprove && onReject && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReject(permission)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
              >
                <X className="size-4 mr-1" /> Rechazar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => onApprove(permission)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="size-4 mr-1" /> Aprobar
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
