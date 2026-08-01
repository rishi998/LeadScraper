import { execSync, spawn } from 'node:child_process';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import type { BusinessCandidate, BusinessSearchInput, ProviderStoragePolicy } from '@leadintel/shared';
import type { BusinessDiscoveryProvider } from './index.js';

export const PLAYWRIGHT_MAPS_STORAGE_POLICY: ProviderStoragePolicy = {
  providerId: 'playwright-maps',
  allowPersistRawPayload: false,
  allowPersistFields: ['externalId', 'name', 'category', 'phone', 'website', 'address'],
  allowExportFields: ['externalId', 'name', 'website', 'phone'],
  retentionDays: 14,
  notes: 'Scraped from Google Maps UI; respect Google Terms of Service and rate limits.',
};

export interface MapsListingRow {
  name: string;
  href: string;
  placeId: string;
  addressHint?: string;
  categoryHint?: string;
  phone?: string;
  website?: string;
}

export interface MapsPlaceDetailSignals {
  telHrefs: string[];
  /** Links from the "Website" row of the place panel; the business's own site. */
  authorityHrefs?: string[];
  linkHrefs: string[];
  buttonLabels: string[];
}

/**
 * Directories, delivery apps, and social profiles that appear as ordinary links on a
 * place panel. Treating one as the business website sends the crawler to the aggregator's
 * contact details instead of the business's own.
 */
const MAPS_AGGREGATOR_HOSTS = [
  'zomato.com', 'swiggy.com', 'magicpin.in', 'dineout.co.in', 'eazydiner.com',
  'tablecheck.com', 'opentable.com', 'resy.com', 'yelp.com',
  'tripadvisor.com', 'tripadvisor.in', 'justdial.com', 'sulekha.com', 'indiamart.com',
  'practo.com', 'urbancompany.com', 'urbanclap.com', 'zocdoc.com',
  'makemytrip.com', 'goibibo.com', 'booking.com', 'agoda.com', 'airbnb.com', 'trivago.in',
  'doordash.com', 'ubereats.com', 'grubhub.com', 'foursquare.com',
  'petpooja.in', 'dotpe.in', 'mydukaan.io',
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'youtube.com', 'whatsapp.com', 'wa.me', 'wa.link', 't.me', 'linktr.ee', 'bit.ly',
];

export function isMapsAggregatorHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return MAPS_AGGREGATOR_HOSTS.some((host) => h === host || h.endsWith(`.${host}`));
}

export interface MapsBrowserProfile {
  userDataDir: string;
  profileDirectory?: string;
  label: string;
  usesExistingChromeProfile: boolean;
}

export interface ChromeProfileInfo {
  directory: string;
  name: string;
  gaiaName?: string;
  userName?: string;
}

export function extractPlaceIdFromMapsUrl(href: string): string {
  const hex = href.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i);
  if (hex?.[1]) return hex[1];

  const kg = href.match(/!16s([^!]+)/i);
  if (kg?.[1]) {
    try {
      return decodeURIComponent(kg[1]);
    } catch {
      return kg[1];
    }
  }

  const chij = href.match(/(ChIJ[a-zA-Z0-9_-]+)/);
  if (chij?.[1]) return chij[1];

  return href.split('?')[0] ?? href;
}

export function parseMapsAriaLabel(label: string): {
  name: string;
  categoryHint?: string;
  addressHint?: string;
} {
  const parts = label
    .split('·')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { name: label.trim() };

  const name = parts[0] ?? label.trim();
  let categoryHint: string | undefined;
  let addressHint: string | undefined;

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (/stars?|\(\d+\)/i.test(part)) continue;
    if (/^\d/.test(part) || part.includes(',')) addressHint = part;
    else if (!categoryHint) categoryHint = part;
  }

  return { name, categoryHint, addressHint };
}

export function unwrapGoogleRedirectUrl(href: string): string {
  try {
    const url = new URL(href);
    if (
      (url.hostname === 'www.google.com' || url.hostname === 'google.com') &&
      url.pathname === '/url'
    ) {
      const q = url.searchParams.get('q');
      if (q) return q;
    }
  } catch {
    // Ignore malformed URLs.
  }
  return href;
}

export function isExcludedMapsWebsiteHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h.includes('google.') ||
    h.includes('gstatic.com') ||
    h.includes('googleusercontent.com') ||
    h === 'g.page' ||
    h.endsWith('.google')
  );
}

export function parsePhoneFromTelHref(href: string): string | undefined {
  const match = href.match(/^tel:([^?#]+)/i);
  return match?.[1]?.trim();
}

export function parsePhoneFromMapsLabel(label: string): string | undefined {
  const match = label.match(/(?:phone|call|mobile)[:\s]+([+\d][\d\s().-]{7,})/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim();
}

export function pickMapsWebsiteUrl(hrefs: string[]): string | undefined {
  for (const raw of hrefs) {
    const href = unwrapGoogleRedirectUrl(raw.trim());
    if (!href.startsWith('http')) continue;
    try {
      const host = new URL(href).hostname;
      if (!isExcludedMapsWebsiteHost(host) && !isMapsAggregatorHost(host)) return href;
    } catch {
      continue;
    }
  }
  return undefined;
}

export function extractMapsPlaceDetails(signals: MapsPlaceDetailSignals): {
  phone?: string;
  website?: string;
} {
  let phone: string | undefined;
  for (const href of signals.telHrefs) {
    phone = parsePhoneFromTelHref(href);
    if (phone) break;
  }
  if (!phone) {
    for (const label of signals.buttonLabels) {
      phone = parsePhoneFromMapsLabel(label);
      if (phone) break;
    }
  }

  return {
    phone,
    website: pickMapsWebsiteUrl([...(signals.authorityHrefs ?? []), ...signals.linkHrefs]),
  };
}

export function resolveMapsPlaceUrl(href: string): string {
  if (href.startsWith('http')) return href;
  return new URL(href, 'https://www.google.com').href;
}

export async function readMapsPlaceDetailSignals(page: Page): Promise<MapsPlaceDetailSignals> {
  return page.evaluate(() => {
    const telHrefs = Array.from(document.querySelectorAll('a[href^="tel:"]')).map(
      (a) => a.getAttribute('href') ?? '',
    );
    const authorityHrefs = [
      ...Array.from(document.querySelectorAll('a[data-item-id="authority"]')),
      ...Array.from(document.querySelectorAll('a[aria-label*="Website" i]')),
    ]
      .map((a) => a.getAttribute('href') ?? '')
      .filter(Boolean);
    const linkHrefs = Array.from(document.querySelectorAll('a[href^="http"]'))
      .map((a) => a.getAttribute('href') ?? '')
      .filter(Boolean);
    const buttonLabels = [
      ...Array.from(document.querySelectorAll('button[data-item-id^="phone"]')),
      ...Array.from(document.querySelectorAll('button[aria-label*="Phone" i]')),
    ].map((el) => el.getAttribute('aria-label') ?? el.textContent ?? '');

    return { telHrefs, authorityHrefs, linkHrefs, buttonLabels };
  });
}

export async function enrichMapsListingFromDetailPanel(
  page: Page,
  listing: MapsListingRow,
): Promise<MapsListingRow> {
  if (listing.phone && listing.website) return listing;

  try {
    await page.goto(resolveMapsPlaceUrl(listing.href), {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    await page.locator('h1').first().waitFor({ timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(600);

    const signals = await readMapsPlaceDetailSignals(page);
    const details = extractMapsPlaceDetails(signals);

    return {
      ...listing,
      phone: listing.phone ?? details.phone,
      website: listing.website ?? details.website,
    };
  } catch {
    return listing;
  }
}

export async function enrichMapsListingsFromDetailPanels(
  page: Page,
  listings: MapsListingRow[],
  options?: { delayMs?: number },
): Promise<MapsListingRow[]> {
  const delayMs = options?.delayMs ?? Number(process.env.PLAYWRIGHT_MAPS_ENRICH_DELAY_MS ?? 1200);
  const enriched: MapsListingRow[] = [];

  for (const listing of listings) {
    enriched.push(await enrichMapsListingFromDetailPanel(page, listing));
    if (delayMs > 0) {
      await page.waitForTimeout(delayMs);
    }
  }

  return enriched;
}

export function shouldEnrichMapsListingDetails(): boolean {
  return process.env.PLAYWRIGHT_MAPS_ENRICH_DETAILS !== 'false';
}

export function mapMapsListingToCandidate(
  listing: MapsListingRow,
  input: BusinessSearchInput,
): BusinessCandidate {
  const parsed = parseMapsAriaLabel(listing.name);
  const displayName = parsed.name || listing.name;

  return {
    externalId: `google-maps:${listing.placeId}`,
    name: displayName,
    category: input.category,
    subcategory: parsed.categoryHint ?? listing.categoryHint,
    phone: listing.phone,
    website: listing.website,
    address: {
      line1: listing.addressHint ?? parsed.addressHint,
      locality: input.locality,
      city: input.city,
      state: input.state,
      country: input.country,
    },
    operationalStatus: 'UNKNOWN',
    queryText: input.queryText,
  };
}

export function resolveChromeLaunchOptions(): {
  channel?: 'chrome';
  executablePath?: string;
} {
  const configured = process.env.CHROME_EXECUTABLE_PATH?.trim();
  if (configured && existsSync(configured)) {
    return { executablePath: configured };
  }

  const candidates = [
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean) as string[];

  for (const path of candidates) {
    if (existsSync(path)) return { executablePath: path };
  }

  return { channel: 'chrome' };
}

export function defaultChromeUserDataDir(): string {
  const local = process.env.LOCALAPPDATA;
  if (!local) {
    throw new Error('LOCALAPPDATA is not set; set CHROME_USER_DATA_DIR manually.');
  }
  return `${local}\\Google\\Chrome\\User Data`;
}

export function defaultMapsProfileDir(): string {
  return resolve(process.cwd(), '.playwright', 'google-maps-profile');
}

export function resolveMapsProfileDir(): string {
  const configured = process.env.PLAYWRIGHT_MAPS_PROFILE_DIR?.trim();
  if (configured) return configured;
  return defaultMapsProfileDir();
}

export function resolveChromeProfileMirrorDir(): string {
  const configured = process.env.CHROME_PROFILE_MIRROR_DIR?.trim();
  if (configured) return configured;
  return resolve(process.cwd(), '.playwright', 'chrome-mirror');
}

export function resolveSourceChromeProfile(): {
  userDataDir: string;
  profileDirectory: string;
} {
  const userDataDir = process.env.CHROME_USER_DATA_DIR?.trim() || defaultChromeUserDataDir();
  const profileDirectory = process.env.CHROME_PROFILE_DIRECTORY?.trim() || 'Default';
  return { userDataDir, profileDirectory };
}

export function resolveMapsBrowserProfile(): MapsBrowserProfile {
  const useExisting = process.env.CHROME_USE_EXISTING_PROFILE === 'true';
  const profileDirectory = process.env.CHROME_PROFILE_DIRECTORY?.trim();

  if (useExisting || profileDirectory) {
    const source = resolveSourceChromeProfile();
    const mirrorRoot = resolveChromeProfileMirrorDir();
    return {
      userDataDir: mirrorRoot,
      profileDirectory: source.profileDirectory,
      label: `Chrome mirror of ${source.profileDirectory} (${mirrorRoot})`,
      usesExistingChromeProfile: true,
    };
  }

  const userDataDir = resolveMapsProfileDir();
  return {
    userDataDir,
    label: userDataDir,
    usesExistingChromeProfile: false,
  };
}

/** Copy a live Chrome profile into a Playwright-safe mirror directory. */
export async function syncChromeProfileMirror(force = false): Promise<string> {
  const source = resolveSourceChromeProfile();
  const mirrorRoot = resolveChromeProfileMirrorDir();
  const sourceProfilePath = `${source.userDataDir}\\${source.profileDirectory}`;
  const mirrorProfilePath = `${mirrorRoot}\\${source.profileDirectory}`;
  const sourceLocalState = `${source.userDataDir}\\Local State`;

  if (!existsSync(sourceProfilePath)) {
    throw new Error(`Chrome profile folder not found: ${sourceProfilePath}`);
  }

  const shouldSync =
    force ||
    process.env.CHROME_SYNC_PROFILE_ON_LAUNCH === 'true' ||
    !existsSync(mirrorProfilePath);

  if (!shouldSync) return mirrorRoot;

  await prepareExistingChromeProfile();

  rmSync(mirrorRoot, { recursive: true, force: true });
  mkdirSync(mirrorRoot, { recursive: true });

  if (existsSync(sourceLocalState)) {
    cpSync(sourceLocalState, `${mirrorRoot}\\Local State`);
  }
  cpSync(sourceProfilePath, mirrorProfilePath, { recursive: true });

  console.log(
    `Synced Chrome profile "${source.profileDirectory}" to ${mirrorRoot}. Playwright will use this mirror.`,
  );
  return mirrorRoot;
}

export function listChromeProfiles(userDataDir = defaultChromeUserDataDir()): ChromeProfileInfo[] {
  const localStatePath = `${userDataDir}\\Local State`;
  if (!existsSync(localStatePath)) {
    throw new Error(`Chrome Local State not found at ${localStatePath}`);
  }

  const localState = JSON.parse(readFileSync(localStatePath, 'utf8')) as {
    profile?: {
      info_cache?: Record<
        string,
        {
          name?: string;
          gaia_name?: string;
          user_name?: string;
        }
      >;
    };
  };

  const cache = localState.profile?.info_cache ?? {};
  return Object.entries(cache).map(([directory, info]) => ({
    directory,
    name: info.name ?? directory,
    gaiaName: info.gaia_name,
    userName: info.user_name,
  }));
}

export function resolveChromeExecutablePath(): string {
  const launch = resolveChromeLaunchOptions();
  if (launch.executablePath) return launch.executablePath;
  throw new Error(
    'Google Chrome executable not found. Install Chrome or set CHROME_EXECUTABLE_PATH in .env.',
  );
}

export function openNativeChrome(profile: MapsBrowserProfile, url: string): void {
  const executablePath = resolveChromeExecutablePath();
  const args = [`--user-data-dir=${profile.userDataDir}`];
  if (profile.profileDirectory) {
    args.push(`--profile-directory=${profile.profileDirectory}`);
  }
  args.push(url);

  const child = spawn(executablePath, args, { detached: true, stdio: 'ignore' });
  child.unref();
}

export function closeAllChromeProcesses(): number {
  if (process.platform === 'win32') {
    try {
      const out = execSync('tasklist /FI "IMAGENAME eq chrome.exe" /NH', { encoding: 'utf8' });
      const count = (out.match(/chrome.exe/gi) ?? []).length;
      if (count > 0) {
        execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
      }
      return count;
    } catch {
      return 0;
    }
  }

  try {
    execSync('pkill -f "Google Chrome" || pkill -f chrome || true', { stdio: 'ignore' });
  } catch {
    // Ignore when nothing is running.
  }
  return 0;
}

export async function prepareExistingChromeProfile(): Promise<void> {
  const profile = resolveMapsBrowserProfile();
  if (!profile.usesExistingChromeProfile) return;

  const shouldKill = process.env.CHROME_KILL_BEFORE_LAUNCH !== 'false';
  if (!shouldKill) {
    throw new Error(
      `Chrome profile "${profile.profileDirectory}" is in use. Close all Chrome windows, or set CHROME_KILL_BEFORE_LAUNCH=true.`,
    );
  }

  const killed = closeAllChromeProcesses();
  if (killed > 0) {
    console.log(`Closed Chrome (${killed} process(es)) to unlock profile ${profile.profileDirectory}.`);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }
}

export async function launchMapsBrowserContext(options: {
  headless: boolean;
}): Promise<{ context: BrowserContext; profile: MapsBrowserProfile }> {
  const profile = resolveMapsBrowserProfile();

  if (!profile.usesExistingChromeProfile) {
    mkdirSync(profile.userDataDir, { recursive: true });
  } else if (!existsSync(profile.userDataDir)) {
    await syncChromeProfileMirror(true);
  }

  const { chromium } = await import('playwright');
  const chrome = resolveChromeLaunchOptions();
  const profileArgs = profile.profileDirectory
    ? [`--profile-directory=${profile.profileDirectory}`, '--disable-blink-features=AutomationControlled']
    : ['--disable-blink-features=AutomationControlled'];

  try {
    const context = await chromium.launchPersistentContext(profile.userDataDir, {
      headless: options.headless,
      ...chrome,
      args: profileArgs,
      ignoreDefaultArgs: ['--enable-automation'],
      viewport: { width: 1280, height: 900 },
      locale: 'en-US',
    });

    return { context, profile };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (profile.usesExistingChromeProfile && message.includes('already in use')) {
      throw new Error(
        `Chrome profile "${profile.profileDirectory}" is still locked. Close every Chrome window from the system tray, wait 5 seconds, then run pnpm maps:login again.`,
      );
    }
    throw err;
  }
}

export function buildMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

export async function scrapeMapsListingsFromPage(
  page: Page,
  query: string,
  maxResults: number,
): Promise<MapsListingRow[]> {
  await page.goto(buildMapsSearchUrl(query), {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  try {
    await page.getByRole('button', { name: /accept all|i agree|accept/i }).click({ timeout: 4000 });
  } catch {
    // No consent banner.
  }

  await page.locator('[role="feed"]').first().waitFor({ timeout: 30_000 });

  const maxScrolls = Math.max(1, Math.ceil(maxResults / 8));
  for (let i = 0; i < maxScrolls; i++) {
    await page.locator('[role="feed"]').evaluate((feed) => {
      feed.scrollTop = feed.scrollHeight;
    });
    await page.waitForTimeout(1200);
  }

  const raw = await page.locator('[role="feed"]').evaluate(
    (feed, limit) => {
      const links = Array.from(feed.querySelectorAll('a[href*="/maps/place/"]'));
      const seen = new Set<string>();
      const rows: Array<{ name: string; href: string }> = [];

      for (const link of links) {
        const href = link.getAttribute('href') ?? '';
        if (!href || seen.has(href)) continue;
        seen.add(href);

        const name =
          link.getAttribute('aria-label')?.trim() ||
          link.textContent?.replace(/\s+/g, ' ').trim() ||
          '';
        if (!name || name.length < 2) continue;

        rows.push({ name, href });
        if (rows.length >= limit) break;
      }

      return rows;
    },
    maxResults,
  );

  return raw.map((row) => {
    const parsed = parseMapsAriaLabel(row.name);
    return {
      name: parsed.name,
      href: row.href,
      placeId: extractPlaceIdFromMapsUrl(row.href),
      addressHint: parsed.addressHint,
      categoryHint: parsed.categoryHint,
    };
  });
}

export class PlaywrightMapsDiscoveryProvider implements BusinessDiscoveryProvider {
  readonly id = 'playwright-maps';
  readonly storagePolicy = PLAYWRIGHT_MAPS_STORAGE_POLICY;

  constructor(
    private readonly headless = process.env.PLAYWRIGHT_MAPS_HEADLESS !== 'false',
    private readonly maxResults = Number(process.env.PLAYWRIGHT_MAPS_MAX_RESULTS ?? 20),
    private readonly launchBrowser?: () => Promise<{
      newPage(): Promise<Page>;
      close(): Promise<void>;
    }>,
  ) {}

  async search(input: BusinessSearchInput): Promise<BusinessCandidate[]> {
    if (this.launchBrowser) {
      const browser = await this.launchBrowser();
      try {
        const page = await browser.newPage();
        const listings = await scrapeMapsListingsFromPage(page, input.queryText, this.maxResults);
        const enriched = shouldEnrichMapsListingDetails()
          ? await enrichMapsListingsFromDetailPanels(page, listings)
          : listings;
        return enriched.map((listing) => mapMapsListingToCandidate(listing, input));
      } finally {
        await browser.close();
      }
    }

    const { context } = await launchMapsBrowserContext({ headless: this.headless });

    try {
      const page = context.pages()[0] ?? (await context.newPage());
      const listings = await scrapeMapsListingsFromPage(page, input.queryText, this.maxResults);
      const enriched = shouldEnrichMapsListingDetails()
        ? await enrichMapsListingsFromDetailPanels(page, listings)
        : listings;
      return enriched.map((listing) => mapMapsListingToCandidate(listing, input));
    } finally {
      await context.close();
    }
  }
}

/** Opens regular Chrome to verify a synced Google session (not Playwright — Google blocks bot sign-in). */
export async function openMapsLoginBrowser(): Promise<void> {
  const profile = resolveMapsBrowserProfile();

  if (profile.usesExistingChromeProfile) {
    const mirrorProfilePath = `${profile.userDataDir}\\${profile.profileDirectory ?? 'Default'}`;
    if (!existsSync(mirrorProfilePath)) {
      console.log(
        [
          'No profile mirror yet.',
          '1) Sign in to Google in your normal Chrome Profile 7',
          '2) Quit Chrome completely',
          '3) Run: pnpm maps:sync-profile',
          '4) Run: pnpm maps:login again',
        ].join('\n'),
      );
      return;
    }

    console.log(
      [
        'Google blocks sign-in inside Playwright/automation browsers.',
        'Sign in only in your NORMAL Chrome Profile 7, then run pnpm maps:sync-profile.',
        '',
        'Opening regular Chrome with your mirrored Profile 7 session on Google Maps...',
      ].join('\n'),
    );
  } else {
    mkdirSync(profile.userDataDir, { recursive: true });
    console.log(
      [
        'Opening regular Chrome for Google sign-in.',
        'Sign in normally, then close Chrome.',
        'Google may block sign-in inside Playwright — this uses real Chrome instead.',
      ].join('\n'),
    );
  }

  const executablePath = resolveChromeExecutablePath();
  openNativeChrome(profile, 'https://www.google.com/maps');
  console.log(`Opened: ${executablePath}`);
  console.log(`Profile: ${profile.label}`);
}
