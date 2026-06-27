import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      thresholds: { lines: 60, functions: 60, branches: 50 },
      include: ['app/**/*.ts', 'lib/**/*.ts'],
      exclude: ['**/*.config.*', '**/*.d.ts', 'app/globals.css'],
    },
  },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
})
