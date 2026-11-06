import 'dotenv/config';
import { defineConfig } from '@prisma/config';

// Schema commands (migrate, db push) use DIRECT_URL, the unpooled connection. The
// pooled DATABASE_URL is for runtime queries only.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DIRECT_URL
  },
});