import { existsSync } from "node:fs";

// Tests that talk to Platform need the same config the app reads. Next loads .env.local
// itself; Vitest doesn't.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
