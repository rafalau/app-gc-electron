import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'apps/electron/prisma/schema.prisma',
  migrations: {
    path: 'apps/electron/prisma/migrations'
  },
  datasource: {
    url: env('DATABASE_URL')
  }
})
