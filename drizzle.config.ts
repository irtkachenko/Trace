import * as dotenv from 'dotenv'; 
import { defineConfig } from 'drizzle-kit';
import { env } from './src/shared/config/env';

dotenv.config({
  path: '.env.local',
});

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});