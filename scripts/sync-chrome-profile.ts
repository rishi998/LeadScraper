import { loadRootEnv } from '../packages/shared/src/load-env.js';
import { syncChromeProfileMirror } from '../packages/providers/src/playwright-maps.js';

loadRootEnv();

syncChromeProfileMirror(true)
  .then((dir) => {
    console.log(`Profile mirror ready at: ${dir}`);
    console.log('Run pnpm maps:login next (Chrome can stay open now).');
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
