import { loadRootEnv } from '../packages/shared/src/load-env.js';
import { launchMapsBrowserContext } from '../packages/providers/src/playwright-maps.js';

loadRootEnv();

async function main() {
  const { context, profile } = await launchMapsBrowserContext({ headless: true });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto('https://www.google.com/maps', {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await page.waitForTimeout(3000);

    const signInVisible = await page
      .getByRole('link', { name: /sign in/i })
      .isVisible()
      .catch(() => false);
    const accountVisible = await page
      .locator('[aria-label*="Google Account"], [aria-label*="Account"]')
      .first()
      .isVisible()
      .catch(() => false);

    console.log(`Profile: ${profile.label}`);
    console.log(`Maps URL: ${page.url()}`);
    console.log(`Sign-in prompt visible: ${signInVisible}`);
    console.log(`Account avatar visible: ${accountVisible}`);
    console.log(`Session looks logged in: ${accountVisible && !signInVisible}`);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
