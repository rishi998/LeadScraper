import { loadRootEnv } from '../packages/shared/src/load-env.js';
import { listChromeProfiles } from '../packages/providers/src/playwright-maps.js';

loadRootEnv();

try {
  const profiles = listChromeProfiles();
  console.log('Chrome profiles found:\n');
  for (const profile of profiles) {
    const account = profile.gaiaName || profile.userName || '(not signed in)';
    console.log(`- ${profile.directory}`);
    console.log(`  Name: ${profile.name}`);
    console.log(`  Account: ${account}`);
    console.log('');
  }
  console.log('To use one, add to .env:');
  console.log('CHROME_USE_EXISTING_PROFILE=true');
  console.log('CHROME_PROFILE_DIRECTORY=Default   # or Profile 1, Profile 2, ...');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
