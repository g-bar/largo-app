import process from 'node:process'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Server-only module. DATABASE_URL is read from the runtime environment. (SvelteKit
// 3 dropped $env/dynamic/private; process.env is the runtime read for adapter-node.)
// The connection is created lazily so importing this module during the build's route
// analysis (no env) doesn't fail; it's only needed when a query actually runs.
let instance: PostgresJsDatabase<typeof schema> | undefined

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
	get(_t, prop) {
		if (!instance) {
			const url = process.env.DATABASE_URL
			if (!url) throw new Error('DATABASE_URL is not set')
			instance = drizzle(postgres(url), { schema })
		}
		return Reflect.get(instance, prop)
	},
})
