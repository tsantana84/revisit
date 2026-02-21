import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['supabase/tests/**/*.test.ts'],
    testTimeout: 30000,  // SDK calls to local Supabase need time
    hookTimeout: 30000,
  },
})
