import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { Visitor } from "../types";
import { StatusBadge } from "./VisitorStatusBadge";
import API from "@/api";

type VisitorDetailsDialogProps = {
  visitor: Visitor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function VisitorDetailsDialog({
  visitor,
  open,
  onOpenChange,
}: VisitorDetailsDialogProps) {
  const [qrPresignedUrl, setQrPresignedUrl] = useState<string | null>(null);
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Fetch presigned URL for QR code when dialog opens
  useEffect(() => {
    if (open && visitor?.qrUrl) {
      setIsLoadingQr(true);
      API.getQrPresignedUrl(visitor.qrUrl)
        .then((response) => {
          setQrPresignedUrl(response.url);
        })
        .catch((err) => {
          console.error("Failed to fetch QR presigned URL:", err);
          // Fallback to original URL for development
          setQrPresignedUrl(visitor.qrUrl ?? null);
        })
        .finally(() => {
          setIsLoadingQr(false);
        });
    }
  }, [open, visitor?.qrUrl]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQrPresignedUrl(null);
    }
  }, [open]);

  if (!visitor) return null;

  const accessAreas = Array.isArray(visitor.accessAreas)
    ? visitor.accessAreas
    : visitor.accessAreas
      ? [visitor.accessAreas]
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{visitor.name}</DialogTitle>
          <DialogDescription>
            Información detallada del visitante.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Estado</p>
            <div className="mt-1">
              <StatusBadge status={visitor.status} />
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Fecha y hora de entrada
            </p>
            <p className="font-medium">
              {new Date(visitor.entryDate).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Fecha y hora de salida
            </p>
            <p className="font-medium">
              {new Date(visitor.exitDate).toLocaleString("es-ES", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Lugares de acceso</p>
            {accessAreas.length > 0 ? (
              <ul className="list-disc list-inside mt-1 space-y-1">
                {accessAreas.map((area, index) => (
                  <li key={index} className="font-medium capitalize">
                    {area}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-medium text-muted-foreground">
                Sin especificar
              </p>
            )}
          </div>
          {visitor.approvedAt && (
            <div>
              <p className="text-sm text-muted-foreground">Aprobado el</p>
              <p className="font-medium">
                {new Date(visitor.approvedAt).toLocaleString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </p>
            </div>
          )}
          {visitor.qrUrl && (
            <div className="mt-6 flex flex-col items-center justify-center border-t pt-6">
              <p className="text-sm font-medium mb-3 text-muted-foreground">
                Código QR de Acceso
              </p>
              <div className="bg-white p-2 rounded-lg border shadow-sm min-h-[200px] min-w-[200px] flex items-center justify-center">
                {isLoadingQr ? (
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                ) : qrPresignedUrl ? (
                  <img
                    src={qrPresignedUrl}
                    alt={`QR de ${visitor.name}`}
                    className="w-48 h-48 object-contain"
                  />
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center max-w-[200px]">
                Este código debe ser presentado en el punto de acceso.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
