import { loadRootEnv } from './load-env';

// Runs via `tsx --import ./src/preload-env.ts` before other modules load.
loadRootEnv();
