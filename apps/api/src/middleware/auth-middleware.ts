import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { auth } from "../core/auth";
import { db } from "../db";
import { member, organization } from "../db/schema";
import { eq } from "drizzle-orm";

// Tipo extendido para el contexto con información del usuario
export interface AuthContext {
  Variables: {
    user: {
      id: string;
      email: string;
      name: string;
      user_face_url?: string[] | null;
      image?: string | null;
      emailVerified: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
    session: {
      id: string;
      expiresAt: Date;
      token: string;
      userId: string;
      createdAt: Date;
      updatedAt: Date;
    };
    organization?: {
      id: string;
      name: string;
      slug: string | null;
      logo: string | null;
      metadata: string | null;
      subscription_id: string | null;
      is_active: boolean;
      createdAt: Date;
      updated_at: Date;
    };
    member?: {
      id: string;
      organizationId: string;
      userId: string;
      role: string;
      createdAt: Date;
    };
  };
}

/**
 * Middleware para proteger rutas que requieren autenticación.
 * Verifica que el usuario tenga una sesión válida y añade la información
 * del usuario al contexto de Hono.
 */
export const requireAuth = createMiddleware<AuthContext>(async (c, next) => {
  try {
    // Obtener la sesión del request usando Better Auth
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    // Si no hay sesión, retornar error 401
    if (!session) {
      throw new HTTPException(401, {
        message: "No autorizado. Se requiere autenticación.",
      });
    }

    // Verificar que la sesión no haya expirado
    if (new Date() > new Date(session.session.expiresAt)) {
      throw new HTTPException(401, {
        message: "Sesión expirada. Por favor, inicia sesión nuevamente.",
      });
    }

    // Añadir la información del usuario y sesión al contexto
    c.set("user", session.user);
    c.set("session", session.session);

    // Nota: Para obtener información de organización y membresía,
    // necesitarías hacer consultas adicionales a la base de datos
    // usando el ID del usuario. Esto se puede hacer en middlewares específicos
    // como requireOrganization cuando sea necesario.

    await next();
  } catch (error) {
    // Si es una HTTPException, la relanzamos
    if (error instanceof HTTPException) {
      throw error;
    }

    // Si es cualquier otro error, retornamos 401
    console.error("Error en middleware de autenticación:", error);
    throw new HTTPException(401, {
      message: "Error de autenticación. Sesión inválida.",
    });
  }
});

/**
 * Middleware para proteger rutas que requieren pertenencia a una organización.
 * Debe usarse después de requireAuth.
 */
export const requireOrganization = createMiddleware<AuthContext>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    throw new HTTPException(401, {
      message: "Usuario no autenticado.",
    });
  }

  try {
    // Buscar la membresía del usuario
    const userMember = await db
      .select()
      .from(member)
      .where(eq(member.userId, user.id))
      .limit(1);

    if (!userMember || userMember.length === 0) {
      throw new HTTPException(403, {
        message: "Acceso denegado. Se requiere pertenencia a una organización.",
      });
    }

    const memberData = userMember[0];
    if (!memberData) {
      throw new HTTPException(403, {
        message: "Datos de membresía no válidos.",
      });
    }
    
    // Buscar la información de la organización
    const userOrganization = await db
      .select()
      .from(organization)
      .where(eq(organization.id, memberData.organizationId))
      .limit(1);

    if (!userOrganization || userOrganization.length === 0) {
      throw new HTTPException(403, {
        message: "Organización no encontrada.",
      });
    }

    const organizationData = userOrganization[0];

    // Añadir la información al contexto
    c.set("member", memberData);
    c.set("organization", organizationData);

    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error("Error en middleware de organización:", error);
    throw new HTTPException(500, {
      message: "Error interno del servidor.",
    });
  }
});

/**
 * Middleware para proteger rutas que requieren un rol específico en la organización.
 * Debe usarse después de requireAuth y requireOrganization.
 */
export const requireRole = (allowedRoles: string[]) => {
  return createMiddleware<AuthContext>(async (c, next) => {
    const member = c.get("member");

    if (!member) {
      throw new HTTPException(403, {
        message: "Acceso denegado. Se requiere pertenencia a una organización.",
      });
    }

    if (!allowedRoles.includes(member.role)) {
      throw new HTTPException(403, {
        message: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(", ")}`,
      });
    }

    await next();
  });
};

/**
 * Middleware para rutas que requieren verificación de email.
 * Debe usarse después de requireAuth.
 */
export const requireEmailVerified = createMiddleware<AuthContext>(async (c, next) => {
  const user = c.get("user");

  if (!user.emailVerified) {
    throw new HTTPException(403, {
      message: "Acceso denegado. Se requiere verificación de email.",
    });
  }

  await next();
});
