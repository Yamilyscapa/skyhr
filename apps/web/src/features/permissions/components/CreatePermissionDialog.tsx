import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";
import { SelectBase } from "@/components/ui/select-base";
import { createPermissionSchema, type CreatePermissionFormValues } from "../schema";
import type { UserInfo } from "../utils";

type CreatePermissionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: {
    message: string;
    startingDate: string;
    endDate: string;
    userId?: string;
    documents?: File[];
  }) => Promise<void>;
  isSubmitting: boolean;
  canManagePermissions: boolean;
  users: UserInfo[];
  currentUserId?: string;
};

export function CreatePermissionDialog({
  open,
  onOpenChange,
  onCreate,
  isSubmitting,
  canManagePermissions,
  users,
  currentUserId,
}: CreatePermissionDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const form = useForm<CreatePermissionFormValues>({
    resolver: zodResolver(createPermissionSchema(canManagePermissions)),
    defaultValues: {
      message: "",
      startingDate: "",
      endDate: "",
      userId: canManagePermissions ? undefined : currentUserId,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        message: "",
        startingDate: "",
        endDate: "",
        userId: canManagePermissions ? undefined : currentUserId,
      });
      setSelectedFiles([]);
      setFileInputKey((prev) => prev + 1);
    }
  }, [open, form, canManagePermissions, currentUserId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter((file) => {
      const validTypes = ["application/pdf", "image/jpeg", "image/png"];
      const maxSize = 10 * 1024 * 1024;

      if (!validTypes.includes(file.type)) {
        return false;
      }

      if (file.size > maxSize) {
        return false;
      }

      return true;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (values: CreatePermissionFormValues) => {
    // Convert date strings (YYYY-MM-DD) to ISO format
    const startingDate = values.startingDate
      ? new Date(values.startingDate).toISOString()
      : "";
    const endDate = values.endDate
      ? new Date(values.endDate + "T23:59:59").toISOString()
      : "";

    await onCreate({
      message: values.message,
      startingDate,
      endDate,
      userId: values.userId || (canManagePermissions ? undefined : currentUserId),
      documents: selectedFiles.length > 0 ? selectedFiles : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear permiso</DialogTitle>
          <DialogDescription>
            Completa los datos para crear una nueva solicitud de permiso.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {canManagePermissions && (
            <Field>
              <FieldLabel htmlFor="permission-user">Usuario *</FieldLabel>
              <FieldContent>
                <SelectBase
                  id="permission-user"
                  value={form.watch("userId") || ""}
                  onChange={(event) =>
                    form.setValue("userId", event.target.value || undefined)
                  }
                >
                  <option value="">Selecciona un usuario</option>
                  {users.map((user) => (
                    <option value={user.id} key={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </SelectBase>
                {form.formState.errors.userId && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.userId.message}
                  </p>
                )}
              </FieldContent>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="permission-message">Motivo o mensaje *</FieldLabel>
            <FieldContent>
              <Textarea
                id="permission-message"
                placeholder="Describe el motivo de tu solicitud de permiso..."
                rows={4}
                {...form.register("message")}
              />
              {form.formState.errors.message && (
                <p className="text-xs text-destructive mt-1">
                  {form.formState.errors.message.message}
                </p>
              )}
            </FieldContent>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="permission-start">Fecha de inicio *</FieldLabel>
              <FieldContent>
                <Input
                  id="permission-start"
                  type="date"
                  {...form.register("startingDate")}
                />
                {form.formState.errors.startingDate && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.startingDate.message}
                  </p>
                )}
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="permission-end">Fecha de fin *</FieldLabel>
              <FieldContent>
                <Input
                  id="permission-end"
                  type="date"
                  {...form.register("endDate")}
                />
                {form.formState.errors.endDate && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.endDate.message}
                  </p>
                )}
              </FieldContent>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="permission-documents">Documentos (opcional)</FieldLabel>
            <FieldContent>
              <Input
                id="permission-documents"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                key={fileInputKey}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos permitidos: PDF, JPEG, PNG. Máximo 10MB por archivo.
              </p>
            </FieldContent>
          </Field>

          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Archivos seleccionados:</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(index)}
                      className="h-6 w-6"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creando..." : "Crear permiso"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

