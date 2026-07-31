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
});
