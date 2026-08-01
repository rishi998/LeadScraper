import { describe, expect, it } from 'vitest';
import { ContactType } from '@leadintel/shared';
import { extractContactsFromHtml, selectPrimaryContacts } from '../src/index.js';

const FIXTURE = `
<html><body>
<footer>
  <a href="mailto:info@smilecare.example.com">Email</a>
  <a href="tel:+919876543210">Call</a>
  <a href="https://wa.me/919876543210">WhatsApp</a>
</footer>
<form action="/contact"><input name="email" /><textarea name="message"></textarea></form>
<script type="application/ld+json">
{"@type":"Dentist","telephone":"+91-98765-43210","email":"info@smilecare.example.com"}
</script>
</body></html>
`;

describe('extractContactsFromHtml', () => {
  it('extracts email phone whatsapp and form', () => {
    const contacts = extractContactsFromHtml({
      url: 'https://smilecare.example.com/contact',
      html: FIXTURE,
      websiteDomain: 'smilecare.example.com',
    });
    expect(contacts.some((c) => c.type === ContactType.EMAIL && c.value === 'info@smilecare.example.com')).toBe(true);
    expect(contacts.some((c) => c.type === ContactType.PHONE)).toBe(true);
    expect(contacts.some((c) => c.type === ContactType.WHATSAPP)).toBe(true);
    expect(contacts.some((c) => c.type === ContactType.CONTACT_FORM)).toBe(true);
    const primaries = selectPrimaryContacts(contacts);
    expect(primaries.length).toBeGreaterThan(0);
  });

  it('ignores error-tracker DSNs and other machine-generated addresses', () => {
    const html = `
<html><body>
  <p>Write to reservations@bistro.example.com</p>
  <script>Sentry.init({dsn:"https://8c4075d5481d476e945486754f783364@sentry.io/12345"});</script>
  <p>placeholder: youremail@example.com</p>
</body></html>`;
    const emails = extractContactsFromHtml({
      url: 'https://bistro.example.com/',
      html,
      websiteDomain: 'bistro.example.com',
    })
      .filter((c) => c.type === ContactType.EMAIL)
      .map((c) => c.value);

    expect(emails).toEqual(['reservations@bistro.example.com']);
  });

  it('does not weld adjacent labels onto an address', () => {
    const html = `
<html><body>
  <div><span>Reservations</span><a href="/x">reservations@bistro.example.com</a><span>Gift Cards</span></div>
</body></html>`;
    const emails = extractContactsFromHtml({
      url: 'https://bistro.example.com/',
      html,
      websiteDomain: 'bistro.example.com',
    })
      .filter((c) => c.type === ContactType.EMAIL)
      .map((c) => c.value);

    expect(emails).toEqual(['reservations@bistro.example.com']);
  });

  it('keeps the address out of a mailto query string', () => {
    const emails = extractContactsFromHtml({
      url: 'https://bistro.example.com/contact',
      html: '<html><body><a href="mailto:hello@bistro.example.com?subject=Table%20for%20two">Mail</a></body></html>',
      websiteDomain: 'bistro.example.com',
    })
      .filter((c) => c.type === ContactType.EMAIL)
      .map((c) => c.value);

    expect(emails).toEqual(['hello@bistro.example.com']);
  });
});
