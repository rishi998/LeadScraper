import { loadRootEnv } from '../packages/shared/src/load-env.js';
import { openMapsLoginBrowser } from '../packages/providers/src/playwright-maps.js';

loadRootEnv();

openMapsLoginBrowser().catch((err) => {
  console.error(err);
  process.exit(1);
});
