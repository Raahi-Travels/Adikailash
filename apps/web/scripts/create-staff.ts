/**
 * Create a staff account.
 *
 * Self sign-up is disabled in `lib/auth.ts` by design, so accounts are made here by
 * someone with database access. This builds a throwaway better-auth instance with
 * sign-up enabled purely to get correct password hashing, then sets roles by SQL.
 *
 *   bun run scripts/create-staff.ts <email> <password> <name> <role,role>
 *
 * Roles must match api.models.staff.StaffRole. Passing none gives read_only, which
 * is the safe default: doc 06 wants least privilege, so an account should never
 * arrive with more access than someone deliberately granted.
 */

import { betterAuth } from "better-auth";
import { Pool } from "pg";

const [email, password, name, rolesArg] = process.argv.slice(2);

if (!email || !password || !name) {
  console.error(
    "Usage: bun run scripts/create-staff.ts <email> <password> <name> [roles]",
  );
  process.exit(1);
}

const VALID_ROLES = new Set([
  "super_admin",
  "founder",
  "ops_manager",
  "trip_coordinator",
  "document_reviewer",
  "status_publisher",
  "content_editor",
  "sales",
  "finance",
  "read_only",
]);

const roles = (rolesArg ?? "read_only")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

const unknown = roles.filter((r) => !VALID_ROLES.has(r));
if (unknown.length > 0) {
  console.error(`Unknown roles: ${unknown.join(", ")}`);
  console.error(`Valid roles: ${[...VALID_ROLES].join(", ")}`);
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const setup = betterAuth({
  database: pool,
  emailAndPassword: { enabled: true, disableSignUp: false },
  user: {
    modelName: "staff_users",
    fields: { emailVerified: "email_verified", createdAt: "created_at", updatedAt: "updated_at" },
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
});

try {
  await setup.api.signUpEmail({ body: { email, password, name } });
  await pool.query(
    `update yatra.staff_users set roles = $1, is_active = true where email = $2`,
    [roles, email],
  );
  console.log(`Created ${email} with roles: ${roles.join(", ")}`);
} catch (err) {
  console.error("Could not create the account:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
