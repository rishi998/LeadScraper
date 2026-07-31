export function fixtureHtmlForBusiness(name: string, phone?: string | null, emailDomain = 'example.com'): string {
  const phoneHref = phone ? `tel:${phone}` : 'tel:+919876543210';
  const email = `info@${emailDomain}`;
  return `<!doctype html>
<html>
<head>
  <title>${name} | Official Site</title>
  <meta name="description" content="${name} — local business website" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="canonical" href="/" />
  <script type="application/ld+json">
  {"@type":"LocalBusiness","name":"${name}","telephone":"${phone ?? '+919876543210'}","email":"${email}"}
  </script>
</head>
<body>
  <header><h1>${name}</h1></header>
  <main>
    <p>Welcome to ${name}. Contact us for appointments and services.</p>
    <a class="cta sticky" href="${phoneHref}">Call Now</a>
    <a href="https://wa.me/${(phone ?? '919876543210').replace(/\D/g, '')}">WhatsApp</a>
    <a href="mailto:${email}">Email us</a>
    <form action="/contact"><input name="name" /><input name="email" /><textarea name="message"></textarea></form>
  </main>
  <footer>
    <a href="mailto:${email}">${email}</a>
    <a href="${phoneHref}">${phone ?? '+91 98765 43210'}</a>
  </footer>
  <script src="https://www.googletagmanager.com/gtm.js"></script>
</body>
</html>`;
}
