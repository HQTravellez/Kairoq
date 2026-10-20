---
name: Secure by default
description: Security rules for every app Kairoq writes: who may read and change data, safe server functions, no secrets in the browser, safe links and redirects, honest error messages. On for every project.
default: on
---
# Secure by default

Kairoq's own checklist for small-business apps, drawing on the OWASP Top 10, on defensive checklists in Anthropic-Cybersecurity-Skills by mukul975 (Apache License 2.0; a community project, not affiliated with Anthropic) and on the vulnerability playbooks in strix by usestrix (Apache License 2.0). Kairoq's security scan checks these rules after every change.

## Data: decide who may see and change it
- Every collection gets the narrowest access that works. Bookings, orders, enquiries, applications, messages and anything with names, emails or phone numbers: "submit-only" (visitors can send, only the owner reads) or "private"/"shared" for signed-in users. "public" only for content everyone may read and nobody personal is in.
- Hiding a screen is not protection. If only staff may see something, the data's access rules (or a server function that checks the user) must enforce it, not an `if (isAdmin)` in the page.
- A signed-in user may change only their own records: check the record's owner in server functions before update or remove.

## Server functions
- Return 401 when a function needs a signed-in `user` and there is none; check the user may act on that record.
- Never save `request.body` as it is. Copy the fields you expect, check their type, length and range (a quantity is a positive whole number, an email looks like one), and set prices, totals, roles and owners on the server, never from what the visitor sent.
- SQL: always parameters (db.sql`... ${value}` or db.sql('... ?', [value]); in Python ctx.db.sql("... ?", [value])). Never build SQL text from values.
- Webhooks: verify the provider's signature over `request.rawBody` with crypto.hmacSha256Hex and compare with crypto.timingSafeEqual before trusting the event.
- Codes, tokens, invite and reset links: crypto.randomId(), never Math.random(). Compare secrets with crypto.timingSafeEqual, not ===.
- Errors: return a short, kind message ("We could not save your booking. Please try again."); keep stack traces and internal details in the logs.
- Fetching other sites: only known hosts, URLs you build yourself, never a URL a visitor typed.

## Who may do what (the mistakes scanners miss)
- Every function that loads a record by an id from the request checks it belongs to the signed-in user (record.owner === user.id) or that the user has a staff role, before returning or changing it. Changing the id in a request must never open someone else's booking, order or invoice.
- Staff and admin functions (exports, refunds, reports, deleting) check the role, not just that someone is signed in.
- Limited places (time slots, seats, tickets, stock): check and book in one step (db.batch, a transaction, or a UNIQUE constraint on slot and date) so two customers cannot take the last one at the same moment.
- Business rules hold on the server: quantities are positive whole numbers within a limit, a coupon is used once per customer, a booking cannot end before it starts, a cancelled order cannot be paid.

## AI inside the app
- The AI's system instructions are fixed text you wrote; what the visitor types goes only in a user message. Never put visitor text, documents or web pages into the system instructions.
- Treat the AI's answer as untrusted text: never run it as code, put it into SQL, follow links it gives or change data because it says so without the normal checks.

## Uploads
- Accept only the types needed (accept="image/*", check file.type and file.size before uploading). Anyone with a file link can open it, so never upload private documents.

## Secrets
- No keys, tokens or passwords in src/: everything there is sent to every visitor. Secrets live in Settings → Server secrets and are read with secrets.get() inside a server function.
- Never log passwords, tokens or full card numbers; never store passwords or tokens in localStorage. Sign-in and sessions are handled by the built-in auth.

## Pages and links
- Let React render text. No dangerouslySetInnerHTML, innerHTML or document.write with anything a visitor or the database supplied; formatted text goes through react-markdown.
- Redirects after sign-in or checkout go only to paths on this site (start with "/", not "//") or a fixed list; never to an address read from the link.
- External links that open a new tab: rel="noopener noreferrer". Load everything over https://.
- postMessage listeners check event.origin before using the data. No eval or new Function.

## Forms and payments
- Validate in the page for a friendly message and again on the server for safety.
- Payments always go through the built-in payments module; the amount comes from the server's price list, never from the page.
- Forms anyone can send (contact, waitlist, booking requests) keep to the fields needed, and say what happens with the data in one line near the button.
