export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  FRONTEND_URLS: (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map(u => u.trim()),
  EXTRA_TRUSTED_ORIGINS: (process.env.EXTRA_TRUSTED_ORIGINS ?? '').split(',').map(u => u.trim()).filter(Boolean),
  MASTER_PASSWORD: process.env.MASTER_PASSWORD ?? '',
  TABLE_SESSION_SECRET: process.env.TABLE_SESSION_SECRET ?? process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
  ZEPTOMAIL_API_KEY: process.env.ZEPTOMAIL_API_KEY ?? '',
  PORT: Number(process.env.PORT ?? 3000),
}

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

if (!env.MASTER_PASSWORD) {
  console.error('MASTER_PASSWORD is required')
  process.exit(1)
}
