import { organization as organizationPlugin } from 'better-auth/plugins';
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { db } from "../db";
import { users, accounts, sessions, verificationTokens, organization, member, invitation, team, teamMember } from "../db/schema";
import { SendInvitationEmail } from "../utils/email";
import { createOrganizationCollection, deleteOrganizationCollection } from "../modules/organizations/organizations.service";
import { TRUSTED_ORIGINS } from "../utils/cors";

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const BETTER_AUTH_URL = process.env.BETTER_AUTH_URL;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;

// Determine if we're using HTTPS based on BETTER_AUTH_URL
const isHttps = BETTER_AUTH_URL?.startsWith('https://') ?? false;
const isDevelopment = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

// Cookie configuration based on environment
// - HTTPS (production): secure=true, sameSite='none' (for cross-site support)
// - HTTP (development): secure=false, sameSite='lax' (for same-origin)
// Better Auth expects cookie configuration in advanced.cookies structure
const cookieAttributes = isHttps
  ? {
    secure: true,
    sameSite: 'none' as const,
    httpOnly: true,
    path: '/',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  }
  : {
    secure: false,
    sameSite: 'lax' as const,
    httpOnly: true,
    path: '/',
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  };

// Build advanced configuration for Better Auth
const advancedConfig: any = {
  cookies: {
    session_token: {
      attributes: cookieAttributes,
    },
  },
  // Force secure cookies in production
  useSecureCookies: isHttps,
};

// Add cross-subdomain cookie support if COOKIE_DOMAIN is set
if (COOKIE_DOMAIN) {
  advancedConfig.crossSubDomainCookies = {
    enabled: true,
    domain: COOKIE_DOMAIN,
  };
}

// Log cookie configuration for debugging
console.log('[Auth] Cookie configuration:', {
  isHttps,
  isDevelopment,
  secure: cookieAttributes.secure,
  sameSite: cookieAttributes.sameSite,
  domain: cookieAttributes.domain || 'not set',
  crossSubDomainEnabled: !!advancedConfig.crossSubDomainCookies,
  baseURL: BETTER_AUTH_URL || "http://localhost:8080",
});

export const auth = betterAuth({
  basePath: "/auth", // Especifica que las rutas serán /auth/* en lugar de /api/auth/*
  plugins: [
    expo(), // Plugin para soporte nativo de Expo
    organizationPlugin({
      // ! Restrict organization creation to only paid users
      allowUserToCreateOrganization: true,
      defaultRole: "member",
      teams: {
        enabled: true,
        maximumTeams: 10,
      },
      async sendInvitationEmail(data: any) {
        const appUrl = process.env.APP_URL;
        const token = data.invitation?.id;

        if (!token) {
          throw new Error("Invitation token is missing for email invitation.");
        }

        const inviteLink: string = `${appUrl}/accept-invitation?token=${token}`;
        const organizationName: string = data.organization.name;

        try {
          await SendInvitationEmail(data.email, inviteLink, organizationName);
        } catch (error) {
          console.error(`Error sending invitation email for organization ${organizationName}:`, {
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
          });
        }
      },
      async onInvitationAccepted(data: any) {
        // TODO: Add logic to handle invitation accepted
      },
      organizationHooks: {
        // Create Rekognition collection after organization is created
        afterCreateOrganization: async ({ organization, member, user }) => {
          console.log(`[afterCreateOrganization Hook] Triggered for organization: ${organization.id}`, {
            organizationId: organization.id,
            organizationName: organization.name,
          });

          try {
            // Directly create Rekognition collection for the new organization
            const collectionId = await createOrganizationCollection(organization.id);

            if (collectionId) {
              console.log(`[afterCreateOrganization Hook] Successfully created Rekognition collection ${collectionId} for organization: ${organization.id}`);
            } else {
              console.error(`[afterCreateOrganization Hook] Failed to create Rekognition collection for organization: ${organization.id}`);
            }
          } catch (error) {
            // Log error but don't fail organization creation
            console.error(`[afterCreateOrganization Hook] Error creating Rekognition collection for organization ${organization.id}:`, {
              error: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
            });
          }
        },
        // Delete Rekognition collection after organization is deleted
        afterDeleteOrganization: async ({ organization }) => {
          try {
            // Directly delete Rekognition collection for the organization
            const success = await deleteOrganizationCollection(organization.id);

            if (success) {
              console.log(`Successfully deleted Rekognition collection for organization: ${organization.id}`);
            } else {
              console.error(`Failed to delete Rekognition collection for organization: ${organization.id}`);
            }
          } catch (error) {
            // Log error but don't fail organization deletion
            console.error(`Error deleting Rekognition collection for organization ${organization.id}:`, error);
          }
        },
      },
    })
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      account: accounts,
      session: sessions,
      verification: verificationTokens,
      organization: organization,
      member: member,
      invitation: invitation,
      team: team,
      teamMember: teamMember,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  advanced: advancedConfig,
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 días
    updateAge: 60 * 60 * 24, // Actualizar cada día,
  },
  user: {
    additionalFields: {
      user_face_url: {
        type: "string[]",
        required: false,
      },
    },
  },
  trustedOrigins: TRUSTED_ORIGINS,
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL || "http://localhost:8080",
});