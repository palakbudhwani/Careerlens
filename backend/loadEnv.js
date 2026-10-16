import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load backend/.env from THIS file's directory instead of process.cwd().
// The backend is started from the project root (`npm run dev`), from backend/,
// or from an editor task — the env file must resolve identically in every case,
// otherwise a fresh checkout silently runs without its provider keys.
export const backendDir = path.dirname(fileURLToPath(import.meta.url));
const backendEnvFile = path.join(backendDir, '.env');

dotenv.config({ path: backendEnvFile });
