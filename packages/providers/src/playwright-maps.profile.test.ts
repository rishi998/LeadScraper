import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resolveMapsBrowserProfile } from './playwright-maps.js';

describe('resolveMapsBrowserProfile', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.CHROME_USE_EXISTING_PROFILE;
    delete process.env.CHROME_PROFILE_DIRECTORY;
    delete process.env.CHROME_USER_DATA_DIR;
    delete process.env.PLAYWRIGHT_MAPS_PROFILE_DIR;
  });

  afterEach(() => {
    process.env = env;
  });

  it('uses isolated playwright profile by default', () => {
    const profile = resolveMapsBrowserProfile();
    expect(profile.usesExistingChromeProfile).toBe(false);
    expect(profile.profileDirectory).toBeUndefined();
  });

  it('uses mirrored chrome profile when configured', () => {
    process.env.CHROME_USE_EXISTING_PROFILE = 'true';
    process.env.CHROME_PROFILE_DIRECTORY = 'Profile 1';

    const profile = resolveMapsBrowserProfile();
    expect(profile.usesExistingChromeProfile).toBe(true);
    expect(profile.userDataDir).toContain('chrome-mirror');
    expect(profile.profileDirectory).toBe('Profile 1');
  });
});
