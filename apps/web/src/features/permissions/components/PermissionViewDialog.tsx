import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, FileText, ExternalLink } from "lucide-react";
import type { Permission } from "../types";
import type { UserInfo } from "../utils";
import { formatDateRange, formatDateTime } from "../utils";
import API from "@/api";

type PermissionViewDialogProps = {
  permission: Permission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usersMap: Map<string, UserInfo>;
};

type DocumentWithUrl = {
  key: string;
  presignedUrl: string | null;
  isLoading: boolean;
  error: string | null;
};

export function PermissionViewDialog({
  permission,
  open,
  onOpenChange,
  usersMap,
}: PermissionViewDialogProps) {
  const [documents, setDocuments] = useState<DocumentWithUrl[]>([]);

  // Fetch presigned URLs for all documents when dialog opens
  const fetchDocumentUrls = useCallback(async () => {
    if (!permission?.documentsUrl?.length) {
      setDocuments([]);
      return;
    }

    // Initialize documents with loading state
    const initialDocs: DocumentWithUrl[] = permission.documentsUrl.map((url) => ({
      key: url,
      presignedUrl: null,
      isLoading: true,
      error: null,
    }));
    setDocuments(initialDocs);

    // Fetch presigned URLs for each document
    const updatedDocs = await Promise.all(
      permission.documentsUrl.map(async (docKey) => {
        try {
          const response = await API.getDocumentPresignedUrl(docKey);
          return {
            key: docKey,
            presignedUrl: response.url,
            isLoading: false,
            error: null,
          };
        } catch (err) {
          console.error("Failed to fetch document presigned URL:", err);
          return {
            key: docKey,
            presignedUrl: docKey, // Fallback to original URL for development
            isLoading: false,
            error: "No se pudo cargar el documento",
          };
        }
      })
    );

    setDocuments(updatedDocs);
  }, [permission?.documentsUrl]);

  useEffect(() => {
    if (open && permission) {
      fetchDocumentUrls();
    } else {
      setDocuments([]);
    }
  }, [open, permission, fetchDocumentUrls]);

  if (!permission) {
    return null;
  }

  const userInfo = usersMap.get(permission.userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Solicitud de permiso</DialogTitle>
          <DialogDescription>
            {userInfo?.name ?? permission.userId}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Usuario</p>
            <p className="font-medium">
              {userInfo?.name ?? permission.userId}
            </p>
            {userInfo?.email && (
              <p className="text-sm text-muted-foreground">{userInfo.email}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Motivo</p>
            <p className="leading-relaxed">{permission.message}</p>
          </div>
          <Separator />
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Vigencia</p>
              <p className="font-medium">
                {formatDateRange(permission.startingDate, permission.endDate)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Última actualización</p>
              <p className="font-medium">
                {formatDateTime(permission.updatedAt)}
              </p>
            </div>
          </div>
          {permission.supervisorComment && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Comentario del supervisor
              </p>
              <p className="leading-relaxed">
                {permission.supervisorComment}
              </p>
            </div>
          )}
          {permission.documentsUrl.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Documentos</p>
              <ul className="space-y-2">
                {documents.map((doc, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    {doc.isLoading ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Cargando documento {index + 1}...
                      </span>
                    ) : doc.presignedUrl ? (
                      <a
                        href={doc.presignedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Documento {index + 1}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-destructive">
                        {doc.error || "Error al cargar"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
