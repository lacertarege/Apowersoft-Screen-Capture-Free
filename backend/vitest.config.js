import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.js'],
        testTimeout: 30000,
        // Ejecutar tests secuencialmente para evitar conflictos de DB
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true
            }
        }
    }
})
