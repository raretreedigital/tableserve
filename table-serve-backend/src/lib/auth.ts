import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, organization, createAccessControl } from 'better-auth/plugins'
import { db } from '../db'
import * as schema from '../db/schema'
import { env } from './env'
import { sendInvitationEmail, sendVerificationEmail } from './email'

// Define the access control statements shared between roles
const ac = createAccessControl({
  user: ['create', 'list', 'set-role', 'ban', 'impersonate', 'delete', 'set-password', 'get', 'update'],
  session: ['list', 'revoke', 'delete'],
})

const superadminRole = ac.newRole({
  user: ['create', 'list', 'set-role', 'ban', 'impersonate', 'delete', 'set-password', 'get', 'update'],
  session: ['list', 'revoke', 'delete'],
})

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [...env.FRONTEND_URLS, ...env.EXTRA_TRUSTED_ORIGINS],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    sendResetPassword: async ({ user: u, url }) => {
      await sendVerificationEmail({ to: u.email, name: u.name, verificationUrl: url })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user: u, url }) => {
      await sendVerificationEmail({ to: u.email, name: u.name, verificationUrl: url })
    },
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['superadmin'],
      roles: {
        superadmin: superadminRole,
      },
    }),
    organization({
      allowUserToCreateOrganization: false,
      organizationLimit: 1,
      membershipLimit: 50,
      async sendInvitationEmail(data) {
        const invitationUrl = `${env.FRONTEND_URLS[0]}/admin/invite?id=${data.id}`
        await sendInvitationEmail({
          inviteeEmail: data.email,
          inviterName: data.inviter.user.name,
          organizationName: data.organization.name,
          invitationUrl,
        })
      },
    }),
  ],
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
})

export type Auth = typeof auth
