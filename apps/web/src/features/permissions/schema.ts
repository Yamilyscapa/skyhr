import { z } from "zod";

export const approvePermissionSchema = z.object({
  comment: z.string().optional(),
});

export const rejectPermissionSchema = z.object({
  comment: z.string().min(1, "El comentario es requerido"),
});

export const createPermissionSchema = (requireUserId: boolean = false) => z.object({
  message: z.string().min(1, "El mensaje es requerido"),
  startingDate: z.string().min(1, "La fecha de inicio es requerida"),
  endDate: z.string().min(1, "La fecha de fin es requerida"),
  userId: requireUserId 
    ? z.string().min(1, "El usuario es requerido")
    : z.string().optional(),
}).refine((data) => {
  const start = new Date(data.startingDate);
  const end = new Date(data.endDate);
  return start <= end;
}, {
  message: "La fecha de inicio debe ser anterior o igual a la fecha de fin",
  path: ["endDate"],
});

export type ApproveFormValues = z.infer<typeof approvePermissionSchema>;
export type RejectFormValues = z.infer<typeof rejectPermissionSchema>;
export type CreatePermissionFormValues = z.infer<ReturnType<typeof createPermissionSchema>>;
