import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  pgEnum,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums para roles organizacionales (Better Auth default roles)
export const organizationRoleEnum = pgEnum("organization_role", [
  "owner",    // Creador de la organización, máximo control
  "admin",    // Administrador, control total excepto eliminar org o cambiar owner
  "member",   // Miembro regular, control limitado
]);

export const announcementPriorityEnum = pgEnum("announcement_priority", [
  "normal",
  "important",
  "urgent",
]);

export const visitorStatusEnum = pgEnum("visitor_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
 ]);

export const permissionStatusEnum = pgEnum("permission_status", [
  "pending",
  "approved",
  "rejected",
]);

// Business Module Tables
export const subscription = pgTable("subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  is_active: boolean("is_active").notNull().default(true),
  max_users: integer("max_users").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at").notNull(),
  metadata: text("metadata"),
  // Custom fields for your application
  subscription_id: uuid("subscription_id").references(() => subscription.id),
  is_active: boolean("is_active").notNull().default(true),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  // Biometrics integration
  rekognition_collection_id: text("rekognition_collection_id").unique(),
});



// Better Auth Core Tables
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  hourlyRate: doublePrecision("hourly_rate"),
  // Custom fields for your application
  user_face_url: text("user_face_url").array(),
  deleted_at: timestamp("deleted_at"),
});

export const user_payroll = pgTable("user_payroll", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").references(() => users.id).notNull(),
  hourly_rate: doublePrecision("hourly_rate").notNull(),
  overtime_allowed: boolean("overtime_allowed").notNull().default(false),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => users.id),
  impersonatedBy: text("impersonatedBy").references(() => users.id),
  activeOrganizationId: text("activeOrganizationId"),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => users.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const verificationTokens = pgTable("verificationTokens", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// Better Auth Organization Plugin Tables
export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  teamId: text("team_id").references(() => team.id),
  status: text("status").default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Better Auth Teams Tables
export const team = pgTable("team", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const teamMember = pgTable("team_member", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => team.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("member").notNull(),
  createdAt: timestamp("created_at").notNull(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").references(() => users.id),
  organization_id: text("organization_id").references(() => organization.id),
  message: text("message").notNull(),
  documents_url: text("documents_url").array(),
  starting_date: timestamp("starting_date").notNull(),
  end_date: timestamp("end_date").notNull(),
  status: permissionStatusEnum("status").notNull().default("pending"),
  approved_by: text("approved_by").references(() => users.id),
  supervisor_comment: text("supervisor_comment"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
});

// Geofence Module
export const geofence = pgTable("geofence", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(), // enum: 'circular', 'polygon', etc.
  center_latitude: text("center_latitude"), // Center point for circular geofence
  center_longitude: text("center_longitude"),
  radius: integer("radius"), // Radius in meters for circular geofence
  coordinates: text("coordinates"), // JSON string for polygon coordinates
  organization_id: text("organization_id").references(() => organization.id),
  qr_code_url: text("qr_code_url"),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
});

// User-Geofence Assignment (Junction Table)
export const user_geofence = pgTable("user_geofence", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  geofence_id: uuid("geofence_id")
    .notNull()
    .references(() => geofence.id, { onDelete: "cascade" }),
  organization_id: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

// Shift Management Module
export const shift = pgTable("shift", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization_id: text("organization_id").references(() => organization.id).notNull(),
  name: text("name").notNull(), // e.g., "Morning Shift", "Night Shift"
  start_time: text("start_time").notNull(), // "09:00:00" format (HH:MM:SS)
  end_time: text("end_time").notNull(), // "17:00:00" format (HH:MM:SS)
  break_minutes: integer("break_minutes").notNull().default(0), // Total break allowance
  days_of_week: text("days_of_week").array().notNull(), // ["monday", "tuesday", ...]
  color: text("color"), // For UI representation (hex color)
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export const user_schedule = pgTable("user_schedule", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").references(() => users.id).notNull(),
  shift_id: uuid("shift_id").references(() => shift.id).notNull(),
  organization_id: text("organization_id").references(() => organization.id).notNull(),
  effective_from: timestamp("effective_from").notNull(),
  effective_until: timestamp("effective_until"), // null = indefinite
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const organization_settings = pgTable("organization_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization_id: text("organization_id").references(() => organization.id).unique().notNull(),
  grace_period_minutes: integer("grace_period_minutes").notNull().default(5),
  extra_hour_cost: doublePrecision("extra_hour_cost").notNull().default(0),
  timezone: text("timezone").notNull().default("UTC"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Attendance Module
export const attendance_event = pgTable("attendance_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: text("user_id").references(() => users.id),
  check_in: timestamp("check_in").notNull(),
  check_out: timestamp("check_out"), // null if not checked out yet
  is_verified: boolean("is_verified").notNull().default(false),
  organization_id: text("organization_id").references(() => organization.id),
  location_id: uuid("location_id").references(() => geofence.id),
  shift_id: uuid("shift_id").references(() => shift.id),
  status: text("status").notNull().default("on_time"), // "on_time", "late", "early", "absent", "out_of_bounds"
  is_within_geofence: boolean("is_within_geofence").notNull().default(true),
  notes: text("notes"), // Admin notes or auto-generated reason
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
  // Geolocation fields
  latitude: text("latitude"), // Using text for precise decimal coordinates
  longitude: text("longitude"),
  distance_to_geofence_m: integer("distance_to_geofence_m"), // Distance in meters
  // Biometric verification fields
  source: text("source").notNull(), // enum: 'face', 'fingerprint', 'manual', 'qr', etc.
  face_confidence: text("face_confidence"), // Confidence score as text for precision
  liveness_score: text("liveness_score"), // Anti-spoofing liveness score
  spoof_flag: boolean("spoof_flag").notNull().default(false), // True if potential spoof detected
});

// Announcements
export const announcement = pgTable("announcement", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization_id: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("message").notNull(),
  priority: announcementPriorityEnum("priority").notNull().default("normal"),
  published_at: timestamp("published_at").notNull().defaultNow(),
  expires_at: timestamp("expires_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
  scope: text("scope"),
  category: text("category"),
});

// Tabla de relación para announcements dirigidos a teams específicos
export const announcement_teams = pgTable("announcement_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcement_id: uuid("announcement_id").notNull().references(() => announcement.id, { onDelete: "cascade" }),
  team_id: text("team_id").notNull().references(() => team.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

// Visitors Module
export const visitors = pgTable("visitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization_id: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  access_areas: text("access_areas").array().notNull(),
  entry_date: timestamp("entry_date").notNull(),
  exit_date: timestamp("exit_date").notNull(),
  status: visitorStatusEnum("status").notNull().default("pending"),
  approved_by_user_id: text("approved_by_user_id").references(() => users.id),
  approved_at: timestamp("approved_at"),
  created_by_user_id: text("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  qr_token: text("qr_token").notNull().unique(),
  qr_url: text("qr_url"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const subscriptionRelations = relations(subscription, ({ many }) => ({
  organizations: many(organization),
}));

export const organizationRelations = relations(
  organization,
  ({ one, many }) => ({
    subscription: one(subscription, {
      fields: [organization.subscription_id],
      references: [subscription.id],
    }),
    attendanceEvents: many(attendance_event),
    announcements: many(announcement),
    geofences: many(geofence),
    userGeofences: many(user_geofence),
    shifts: many(shift),
    userSchedules: many(user_schedule),
    settings: one(organization_settings, {
      fields: [organization.id],
      references: [organization_settings.organization_id],
    }),
    // Better Auth organization plugin relations
    members: many(member),
    invitations: many(invitation),
    teams: many(team),
    visitors: many(visitors),
    permissions: many(permissions),
  }),
);

export const usersRelations = relations(users, ({ one, many }) => ({
  permissions: many(permissions),
  attendanceEvents: many(attendance_event),
  userSchedules: many(user_schedule),
  userGeofences: many(user_geofence),
  // Better Auth relations
  sessions: many(sessions),
  accounts: many(accounts),
  // Better Auth organization plugin relations
  memberships: many(member),
  sentInvitations: many(invitation),
  teamMemberships: many(teamMember),
  visitorsCreated: many(visitors),
  visitorsApproved: many(visitors),
  payroll: one(user_payroll, {
    fields: [users.id],
    references: [user_payroll.user_id],
  }),
}));

export const userPayrollRelations = relations(user_payroll, ({ one }) => ({
  user: one(users, {
    fields: [user_payroll.user_id],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const verificationTokensRelations = relations(verificationTokens, ({ one }) => ({
  // Verification tokens don't typically have user relations in Better Auth
  // They're identified by email/identifier
}));

export const permissionsRelations = relations(permissions, ({ one }) => ({
  user: one(users, {
    fields: [permissions.user_id],
    references: [users.id],
  }),
  organization: one(organization, {
    fields: [permissions.organization_id],
    references: [organization.id],
  }),
  approvedBy: one(users, {
    fields: [permissions.approved_by],
    references: [users.id],
    relationName: "approvedBy",
  }),
}));

export const attendanceEventRelations = relations(
  attendance_event,
  ({ one }) => ({
    user: one(users, {
      fields: [attendance_event.user_id],
      references: [users.id],
    }),
    organization: one(organization, {
      fields: [attendance_event.organization_id],
      references: [organization.id],
    }),
    location: one(geofence, {
      fields: [attendance_event.location_id],
      references: [geofence.id],
    }),
    shift: one(shift, {
      fields: [attendance_event.shift_id],
      references: [shift.id],
    }),
  }),
);

export const shiftRelations = relations(shift, ({ one, many }) => ({
  organization: one(organization, {
    fields: [shift.organization_id],
    references: [organization.id],
  }),
  userSchedules: many(user_schedule),
  attendanceEvents: many(attendance_event),
}));

export const userScheduleRelations = relations(user_schedule, ({ one }) => ({
  user: one(users, {
    fields: [user_schedule.user_id],
    references: [users.id],
  }),
  shift: one(shift, {
    fields: [user_schedule.shift_id],
    references: [shift.id],
  }),
  organization: one(organization, {
    fields: [user_schedule.organization_id],
    references: [organization.id],
  }),
}));

export const organizationSettingsRelations = relations(organization_settings, ({ one }) => ({
  organization: one(organization, {
    fields: [organization_settings.organization_id],
    references: [organization.id],
  }),
}));

export const announcementRelations = relations(announcement, ({ one, many }) => ({
  organization: one(organization, {
    fields: [announcement.organization_id],
    references: [organization.id],
  }),
  teams: many(announcement_teams),
}));

export const announcementTeamsRelations = relations(announcement_teams, ({ one }) => ({
  announcement: one(announcement, {
    fields: [announcement_teams.announcement_id],
    references: [announcement.id],
  }),
  team: one(team, {
    fields: [announcement_teams.team_id],
    references: [team.id],
  }),
}));

export const visitorsRelations = relations(visitors, ({ one }) => ({
  organization: one(organization, {
    fields: [visitors.organization_id],
    references: [organization.id],
  }),
  createdBy: one(users, {
    fields: [visitors.created_by_user_id],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [visitors.approved_by_user_id],
    references: [users.id],
  }),
}));

export const geofenceRelations = relations(geofence, ({ one, many }) => ({
  organization: one(organization, {
    fields: [geofence.organization_id],
    references: [organization.id],
  }),
  userGeofences: many(user_geofence),
  attendanceEvents: many(attendance_event),
}));

export const userGeofenceRelations = relations(user_geofence, ({ one }) => ({
  user: one(users, {
    fields: [user_geofence.user_id],
    references: [users.id],
  }),
  geofence: one(geofence, {
    fields: [user_geofence.geofence_id],
    references: [geofence.id],
  }),
  organization: one(organization, {
    fields: [user_geofence.organization_id],
    references: [organization.id],
  }),
}));


// Better Auth Organization Plugin Relations
export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(users, {
    fields: [member.userId],
    references: [users.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  team: one(team, {
    fields: [invitation.teamId],
    references: [team.id],
  }),
  inviter: one(users, {
    fields: [invitation.inviterId],
    references: [users.id],
  }),
}));

// Team Relations
export const teamRelations = relations(team, ({ one, many }) => ({
  organization: one(organization, {
    fields: [team.organizationId],
    references: [organization.id],
  }),
  members: many(teamMember),
  announcements: many(announcement_teams),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, {
    fields: [teamMember.teamId],
    references: [team.id],
  }),
  user: one(users, {
    fields: [teamMember.userId],
    references: [users.id],
  }),
}));
