import { betterAuth } from "better-auth";
import { Pool } from "pg";

/**
 * Staff authentication (decision D8).
 *
 * **The tables are ours, not better-auth's.** Raahi's `public` schema already holds
 * better-auth's default `user` / `session` / `account` / `verification` tables for
 * the cab platform. Letting this instance use those names in the default schema
 * would collide with a live product, so:
 *
 *   - every model is renamed to `staff_*` and lives in `yatra`
 *   - the connection string pins `search_path=yatra`
 *   - the schema is created by our Alembic migration, and
 *     `@better-auth/cli migrate` is NEVER run against this database
 *
 * If you add a better-auth feature that wants new columns, add them to
 * `apps/api/src/api/models/staff.py` and migrate there. Do not let the CLI do it.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required for staff authentication.");
}

export const auth = betterAuth({
  database: new Pool({ connectionString }),

  emailAndPassword: {
    enabled: true,
    // Staff accounts are created by an administrator, not self-served. Doc 06: "No
    // one should gain broad access simply because they are part of the family."
    disableSignUp: true,
  },

  user: {
    modelName: "staff_users",
    fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" },
    additionalFields: {
      roles: { type: "string[]", required: false, input: false },
      is_active: { type: "boolean", required: false, input: false },
    },
  },
  session: {
    modelName: "staff_sessions",
    fields: {
      userId: "user_id",
      expiresAt: "expires_at",
      ipAddress: "ip_address",
      userAgent: "user_agent",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  account: {
    modelName: "staff_accounts",
    fields: {
      userId: "user_id",
      accountId: "account_id",
      providerId: "provider_id",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      idToken: "id_token",
      accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "staff_verifications",
    fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" },
  },

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});

export type StaffSession = typeof auth.$Infer.Session;
