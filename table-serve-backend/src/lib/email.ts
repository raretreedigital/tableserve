import { env } from './env'
import { log } from './logger'

const ZEPTO_API_URL = 'https://api.zeptomail.com/v1.1/email'
const FROM_ADDRESS = 'notification-tableserve@raretree.io'
const FROM_NAME = 'Table Serve'

async function sendEmail({
  to,
  toName,
  subject,
  htmlBody,
  textBody,
}: {
  to: string
  toName?: string
  subject: string
  htmlBody: string
  textBody: string
}) {
  if (!env.ZEPTOMAIL_API_KEY) {
    log.warn('email-skipped', { reason: 'ZEPTOMAIL_API_KEY not set', to, subject })
    return
  }

  const payload = {
    from: { address: FROM_ADDRESS, name: FROM_NAME },
    to: [{ email_address: { address: to, name: toName ?? to } }],
    subject,
    htmlbody: htmlBody,
    textbody: textBody,
  }

  try {
    const res = await fetch(ZEPTO_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Zoho-enczapikey ${env.ZEPTOMAIL_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.text()
      if (res.status === 429) {
        log.warn('email-skipped', { reason: 'ZeptoMail credit exhausted (429)', to, subject })
      } else {
        log.error('email-failed', { to, subject, status: res.status, body })
      }
    } else {
      log.info('email-sent', { to, subject })
    }
  } catch (err: any) {
    log.error('email-error', { to, subject, message: err.message })
  }
}

export async function sendActivationEmail({
  adminName,
  adminEmail,
  organizationName,
  plan,
  loginUrl,
}: {
  adminName: string
  adminEmail: string
  organizationName: string
  plan: string
  loginUrl: string
}) {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#8c5c3e;padding:32px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;">Table Serve</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">🎉 Your account is now active!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
              Hi <strong>${adminName}</strong>, great news — <strong>${organizationName}</strong> has been activated on the <strong>${planLabel}</strong> plan.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#6b7280;">
              You now have full access to all features. Sign in to get started.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#8c5c3e;border-radius:8px;">
                  <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                    Go to Dashboard
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              © ${new Date().getFullYear()} Table Serve · notification-tableserve@raretree.io
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const textBody = `Your account is now active!

Hi ${adminName}, ${organizationName} has been activated on the ${planLabel} plan.

You now have full access to all features. Sign in at:
${loginUrl}`

  await sendEmail({
    to: adminEmail,
    toName: adminName,
    subject: `🎉 ${organizationName} is now active on Table Serve`,
    htmlBody,
    textBody,
  })
}

export async function sendInvitationEmail({
  inviteeName,
  inviteeEmail,
  inviterName,
  organizationName,
  invitationUrl,
}: {
  inviteeName?: string
  inviteeEmail: string
  inviterName: string
  organizationName: string
  invitationUrl: string
}) {
  const displayName = inviteeName ?? inviteeEmail

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#8c5c3e;padding:32px 40px;text-align:center;">
            <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Table Serve</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">You're invited!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#6b7280;">
              <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Table Serve.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#6b7280;">
              Click the button below to accept your invitation and set up your account.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#8c5c3e;border-radius:8px;">
                  <a href="${invitationUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
                    Accept Invitation
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:32px 0 0;font-size:13px;color:#9ca3af;">
              Or copy this link into your browser:<br>
              <a href="${invitationUrl}" style="color:#8c5c3e;word-break:break-all;">${invitationUrl}</a>
            </p>
            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
              This invitation was sent to <strong>${inviteeEmail}</strong>. If you did not expect this, you can safely ignore it.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              © ${new Date().getFullYear()} Table Serve · Sent from notification-tableserve@raretree.io
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const textBody = `You're invited to join ${organizationName} on Table Serve!

${inviterName} has invited you to join their team.

Accept your invitation here:
${invitationUrl}

This invitation was sent to ${inviteeEmail}. If you did not expect this, you can safely ignore it.`

  await sendEmail({
    to: inviteeEmail,
    toName: displayName,
    subject: `You're invited to join ${organizationName} on Table Serve`,
    htmlBody,
    textBody,
  })
}

// ─── Email verification ───────────────────────────────────────────────────────

export async function sendVerificationEmail({ to, name, verificationUrl }: {
  to: string
  name: string
  verificationUrl: string
}) {
  const yr = new Date().getFullYear()
  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);"><tr><td style="background:#8c5c3e;padding:28px 40px;text-align:center;"><span style="color:#fff;font-size:20px;font-weight:700;">Table Serve</span></td></tr><tr><td style="padding:40px;"><h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">Verify your email</h1><p style="margin:0 0 24px;font-size:15px;color:#6b7280;">Hi <strong>${name}</strong>, click below to verify your email and activate your Table Serve account.</p><table cellpadding="0" cellspacing="0"><tr><td style="background:#8c5c3e;border-radius:8px;"><a href="${verificationUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Verify Email</a></td></tr></table><p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">Or copy: <a href="${verificationUrl}" style="color:#8c5c3e;word-break:break-all;">${verificationUrl}</a></p><p style="margin:12px 0 0;font-size:13px;color:#9ca3af;">This link expires in 24 hours. If you did not sign up, ignore this email.</p></td></tr><tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${yr} Table Serve &middot; notification-tableserve@raretree.io</p></td></tr></table></td></tr></table></body></html>`

  await sendEmail({
    to,
    toName: name,
    subject: 'Verify your Table Serve email address',
    htmlBody,
    textBody: `Hi ${name},\n\nVerify your email:\n${verificationUrl}\n\nExpires in 24 hours.`,
  })
}

// ─── Welcome (self-serve registration) ───────────────────────────────────────

export async function sendWelcomeEmail({ adminName, adminEmail, organizationName, loginUrl }: {
  adminName: string
  adminEmail: string
  organizationName: string
  loginUrl: string
}) {
  const yr = new Date().getFullYear()
  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);"><tr><td style="background:#8c5c3e;padding:28px 40px;text-align:center;"><span style="color:#fff;font-size:20px;font-weight:700;">Table Serve</span></td></tr><tr><td style="padding:40px;"><h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">Welcome to Table Serve!</h1><p style="margin:0 0 12px;font-size:15px;color:#6b7280;">Hi <strong>${adminName}</strong>, your restaurant <strong>${organizationName}</strong> has been registered.</p><p style="margin:0 0 28px;font-size:15px;color:#6b7280;">Your account is in <strong>trial mode</strong>: up to 10 menu items and 3 tables. Our team will review and activate your account — you will receive an email when it is ready.</p><table cellpadding="0" cellspacing="0"><tr><td style="background:#8c5c3e;border-radius:8px;"><a href="${loginUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Sign In</a></td></tr></table></td></tr><tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${yr} Table Serve &middot; notification-tableserve@raretree.io</p></td></tr></table></td></tr></table></body></html>`

  await sendEmail({
    to: adminEmail,
    toName: adminName,
    subject: `Welcome to Table Serve — ${organizationName} is registered`,
    htmlBody,
    textBody: `Hi ${adminName},\n\n${organizationName} is registered on Table Serve in trial mode (up to 10 menu items, 3 tables).\n\nOur team will activate your account shortly.\n\nSign in: ${loginUrl}`,
  })
}

// ─── Account suspended ────────────────────────────────────────────────────────

export async function sendSuspensionEmail({ adminName, adminEmail, organizationName, reason }: {
  adminName: string
  adminEmail: string
  organizationName: string
  reason: string
}) {
  const yr = new Date().getFullYear()
  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);"><tr><td style="background:#991b1b;padding:28px 40px;text-align:center;"><span style="color:#fff;font-size:20px;font-weight:700;">Table Serve</span></td></tr><tr><td style="padding:40px;"><h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">Account suspended</h1><p style="margin:0 0 12px;font-size:15px;color:#6b7280;">Hi <strong>${adminName}</strong>, your <strong>${organizationName}</strong> account has been suspended.</p><p style="margin:0 0 24px;font-size:15px;color:#6b7280;"><strong>Reason:</strong> ${reason}</p><p style="margin:0;font-size:14px;color:#6b7280;">Contact support: <a href="mailto:notification-tableserve@raretree.io" style="color:#8c5c3e;">notification-tableserve@raretree.io</a></p></td></tr><tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${yr} Table Serve &middot; notification-tableserve@raretree.io</p></td></tr></table></td></tr></table></body></html>`

  await sendEmail({
    to: adminEmail,
    toName: adminName,
    subject: `Your ${organizationName} account has been suspended`,
    htmlBody,
    textBody: `Hi ${adminName},\n\n${organizationName} has been suspended.\n\nReason: ${reason}\n\nContact: notification-tableserve@raretree.io`,
  })
}

// ─── Subscription changed ─────────────────────────────────────────────────────

export async function sendSubscriptionChangeEmail({ adminName, adminEmail, organizationName, plan, expiry, loginUrl }: {
  adminName: string
  adminEmail: string
  organizationName: string
  plan: string
  expiry?: Date | null
  loginUrl: string
}) {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
  const yr = new Date().getFullYear()
  const expiryLine = expiry
    ? `<p style="margin:0 0 28px;font-size:15px;color:#6b7280;">Valid until: <strong>${expiry.toDateString()}</strong></p>`
    : ''
  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);"><tr><td style="background:#8c5c3e;padding:28px 40px;text-align:center;"><span style="color:#fff;font-size:20px;font-weight:700;">Table Serve</span></td></tr><tr><td style="padding:40px;"><h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">Subscription updated</h1><p style="margin:0 0 12px;font-size:15px;color:#6b7280;">Hi <strong>${adminName}</strong>, your <strong>${organizationName}</strong> subscription has been updated to the <strong>${planLabel}</strong> plan.</p>${expiryLine}<table cellpadding="0" cellspacing="0"><tr><td style="background:#8c5c3e;border-radius:8px;"><a href="${loginUrl}" style="display:inline-block;padding:13px 28px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;">Go to Dashboard</a></td></tr></table></td></tr><tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${yr} Table Serve &middot; notification-tableserve@raretree.io</p></td></tr></table></td></tr></table></body></html>`

  await sendEmail({
    to: adminEmail,
    toName: adminName,
    subject: `${organizationName} subscription updated to ${planLabel}`,
    htmlBody,
    textBody: `Hi ${adminName},\n\n${organizationName} subscription updated to ${planLabel}.${expiry ? '\nValid until: ' + expiry.toDateString() : ''}\n\nSign in: ${loginUrl}`,
  })
}

// ─── New organization registered (internal alert) ────────────────────────────

export async function sendNewOrganizationNotification({ organizationName, adminName, adminEmail }: {
  organizationName: string
  adminName: string
  adminEmail: string
}) {
  const yr = new Date().getFullYear()
  const now = new Date().toUTCString()
  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,ui-sans-serif,system-ui,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);"><tr><td style="background:#8c5c3e;padding:28px 40px;text-align:center;"><span style="color:#fff;font-size:20px;font-weight:700;">Table Serve</span></td></tr><tr><td style="padding:40px;"><h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;">&#x1F3E2; New restaurant registered</h1><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;width:140px;">Organization</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#111827;">${organizationName}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Admin name</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${adminName}</td></tr><tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:14px;">Admin email</td><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${adminEmail}</td></tr><tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Registered at</td><td style="padding:10px 0;font-size:14px;color:#111827;">${now}</td></tr></table><p style="margin:0;font-size:13px;color:#9ca3af;">Review this organization in the superadmin dashboard.</p></td></tr><tr><td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;"><p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">&copy; ${yr} Table Serve &middot; Internal notification</p></td></tr></table></td></tr></table></body></html>`

  await sendEmail({
    to: 'cto@raretree.io',
    toName: 'CTO',
    subject: `New restaurant registered: ${organizationName}`,
    htmlBody,
    textBody: `New restaurant registered on Table Serve.\n\nOrganization: ${organizationName}\nAdmin: ${adminName} <${adminEmail}>\nRegistered at: ${now}`,
  })
}
