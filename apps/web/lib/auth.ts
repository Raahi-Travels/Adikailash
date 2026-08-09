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

/**
 * Built lazily, on first request rather than at module load.
 *
 * `next build` runs with NODE_ENV=production, so a module-level check for
 * DATABASE_URL fails the build on any host where env vars are supplied at runtime
 * (Vercel included). Static generation has no business needing a database
 * connection. The check still happens, just at the point where auth is actually
 * used, where the error can reach an operator instead of a build log.
 */
// Typed from `build` rather than `betterAuth` so the specific model and field
// config survives; the generic Auth<BetterAuthOptions> loses it.
let instance: ReturnType<typeof build> | null = null;

function build() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required for staff authentication. Set it in the deployment " +
        "environment; it must include ?options=-c%20search_path%3Dyatra so better-auth " +
        "cannot reach Raahi's public schema.",
    );
  }

  return betterAuth({
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
}

/** The auth instance. Constructs on first use, then memoised. */
export function getAuth(): ReturnType<typeof build> {
  instance ??= build();
  return instance;
}

export type StaffSession = ReturnType<typeof getAuth>["$Infer"]["Session"];
