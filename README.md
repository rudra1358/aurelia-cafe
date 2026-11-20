<div align="center">

<img src="docs/screenshots/hero.jpg" alt="Aurelia website — hero section with a sunlit café interior and the AURELIA wordmark" width="100%">

<br><br>

# A U R E L I A

### *Where every cup tells a story.*

A premium, fully responsive website for a café in **Sindhu Bhavan, Ahmedabad**, with real table reservations that send emails and save to Google Sheets.

<br>

![Next.js](https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-0F172A?style=for-the-badge&logo=tailwindcss&logoColor=38BDF8)
![Nodemailer](https://img.shields.io/badge/Nodemailer-Gmail_SMTP-EA4335?style=for-the-badge&logo=gmail&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets-34A853?style=for-the-badge&logo=googlesheets&logoColor=white)

<br>

[**Features**](#-features) · [**Screenshots**](#-screenshots) · [**How it works**](#-how-a-reservation-works) · [**Quick start**](#-quick-start) · [**Email setup**](#-gmail-setup) · [**Sheets setup**](#-google-sheets-setup) · [**Customize**](#-customizing-the-content)

</div>

<br>

---

## ✦ Features

<table>
<tr>
<td width="33%" valign="top">

### 🎨 Editorial design
Modern minimalist luxury: Cormorant Garamond with DM Sans, a warm cream-and-espresso palette, asymmetric layouts and generous whitespace.

</td>
<td width="33%" valign="top">

### 📅 Real reservations
A validated form with loading, success and error states and protection against double submits. Success is shown **only** after the emails are actually sent.

</td>
<td width="33%" valign="top">

### ✉️ Two automatic emails
The guest gets a branded acknowledgement. The owner gets every detail, with one-click **Reply** and **Call** buttons.

</td>
</tr>
<tr>
<td valign="top">

### 📊 Google Sheets log
Every request becomes a row with a reference number and a **Status** dropdown (Pending → Confirmed → Completed).

</td>
<td valign="top">

### ☕ Data-driven menu
All 16 drinks with ₹ prices and bestseller labels come from one file. Add a food section and it appears automatically.

</td>
<td valign="top">

### 📱 Responsive & accessible
Designed for phone, tablet and desktop. Semantic HTML, keyboard navigation, visible focus, alt text and reduced-motion support.

</td>
</tr>
<tr>
<td valign="top">

### 🔎 SEO ready
Metadata, Open Graph and Twitter cards, a sitemap, robots.txt and structured data for a café (`CafeOrCoffeeShop`).

</td>
<td valign="top">

### ⚖️ Legal pages
`/privacy-policy` and `/terms-and-conditions` match how the site actually works and fill in from the café's settings.

</td>
<td valign="top">

### 🛡️ Secure by default
Credentials stay on the server. Input is validated on both client and server, with a spam honeypot, rate limiting and HTML-escaped emails.

</td>
</tr>
</table>

<br>

## ✦ Screenshots

<table>
<tr>
<td width="50%"><img src="docs/screenshots/about.jpg" alt="About section: pour-over coffee photo beside the heading 'A little more than just coffee.'"></td>
<td width="50%"><img src="docs/screenshots/menu.jpg" alt="Drinks menu in three columns with rupee prices and bestseller labels"></td>
</tr>
<tr>
<td align="center"><sub><b>About</b> · asymmetric editorial layout</sub></td>
<td align="center"><sub><b>Menu</b> · aligned ₹ prices and bestseller labels</sub></td>
</tr>
</table>

<img src="docs/screenshots/reservation.jpg" alt="Reservation section: 'Your table is waiting.' with the booking form on a dark background" width="100%">
<p align="center"><sub><b>Reservations</b> · validated request form with policies shown up front</sub></p>

<br>

<div align="center">
<table>
<tr>
<td><img src="docs/screenshots/mobile-hero.jpg" alt="Mobile hero" width="240"></td>
<td><img src="docs/screenshots/mobile-menu.jpg" alt="Mobile navigation menu open" width="240"></td>
<td><img src="docs/screenshots/mobile-form.jpg" alt="Mobile reservation form" width="240"></td>
</tr>
<tr>
<td align="center"><sub>Mobile hero</sub></td>
<td align="center"><sub>Navigation</sub></td>
<td align="center"><sub>Reservation form</sub></td>
</tr>
</table>
</div>

<details>
<summary><b>View the "Made to be savored." section</b></summary>
<br>
<img src="docs/screenshots/experiences.jpg" alt="Signature experiences: six numbered photos of croissants, cappuccino, pancakes, desserts, sandwiches and iced coffee in a staggered layout" width="100%">
</details>

<br>

## ✦ How a reservation works

```mermaid
sequenceDiagram
    autonumber
    actor Guest
    participant Site as Website form
    participant API as /api/reservations
    participant Sheet as Google Sheet
    participant Gmail as Gmail SMTP
    actor Owner

    Guest->>Site: Fills in name, contact, date, time, guests
    Site->>Site: Validates in the browser
    Site->>API: POST request
    API->>API: Re-validates · honeypot · rate limit
    API->>Sheet: Adds a row (reference, status "Pending")
    Sheet-->>API: …or "duplicate" if the same guest already asked for that slot
    API->>Gmail: Email 2: "New Table Reservation"
    Gmail-->>Owner: Details + Reply / Call buttons
    API->>Gmail: Email 1: "Your Reservation Request"
    Gmail-->>Guest: Acknowledgement (not yet confirmed)
    API-->>Site: Success only after both emails send
    Owner->>Guest: Contacts guest to confirm
    Owner->>Sheet: Updates Status → Confirmed
```

> [!NOTE]
> A submission is a reservation **request**, not a confirmed booking. The guest is told this on the form, on the success screen and in their email.
> If the Google Sheet can't be reached, the emails still go out, and the owner email shows a red note so the row can be added by hand.
> If the emails fail after the row is saved, the row is marked **Email failed** so the owner still sees it.

<br>

## ✦ Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # → http://localhost:3000
```

| Command | Description |
|:--|:--|
| `npm run dev` | Start the development server |
| `npm run build` · `npm start` | Production build · serve it |
| `npm run typecheck` | TypeScript check |
| `npm run test:email` | Log in to Gmail SMTP and send one test email to yourself |
| `npm run test:email:fallback` | Log in to the backup provider and send one test email to `OWNER_EMAIL` |
| `npm run test:sheet` | Add one test row to the Google Sheet |

> Requires **Node.js 20.9+**.

### Environment variables

| Variable | Required | Description |
|:--|:--:|:--|
| `GMAIL_USER` | ✅ | Gmail address that **sends** the emails |
| `GMAIL_APP_PASSWORD` | ✅ | 16-character Google App Password (not your normal password) |
| `OWNER_EMAIL` | ✅ | Inbox that **receives** new requests |
| `SMTP_PORT` | — | `465` (SSL, default) or `587` (STARTTLS) |
| `SMTP_HOST` | — | Advanced: another SMTP server instead of Gmail |
| `OWNER_NOTIFY` | — | `each` (default) emails the owner for every booking. `off` relies on the Google Sheet and still emails the owner if a booking can't be saved there |
| `FALLBACK_SMTP_HOST` · `_PORT` · `_USER` · `_PASS` | — | Optional backup provider (e.g. Brevo), used when Gmail fails or hits its daily limit |
| `FALLBACK_FROM_EMAIL` | — | Sender address verified with the backup provider |
| `GOOGLE_SHEETS_WEBHOOK_URL` | — | Apps Script web app URL (ends in `/exec`). Leave empty to turn the sheet off |
| `GOOGLE_SHEETS_SECRET` | — | Shared secret, which must match `SECRET` in the Apps Script |
| `NEXT_PUBLIC_SITE_URL` | — | Public URL, used for SEO and social previews |

> [!IMPORTANT]
> `.env.local` is git-ignored. Never commit real credentials.

<br>

## ✦ Gmail setup

<details>
<summary><b>Step-by-step: create an App Password and send a test email</b></summary>

<br>

1. **Turn on 2-Step Verification** at <https://myaccount.google.com/security>. App Passwords only exist on accounts that have it.
2. **Create an App Password** at <https://myaccount.google.com/apppasswords>. Name it `Aurelia website`, click **Create**, and copy the 16-character password. Google shows it only once.
3. **Add it to `.env.local`:**
   ```ini
   GMAIL_USER=the-sending-account@gmail.com
   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop   # spaces are fine
   OWNER_EMAIL=owner@example.com
   ```
4. **Test it** with `npm run test:email`. You should see `✓ Logged in…` and receive a test email.
5. Restart `npm run dev` and submit the form with your own address. **Both** emails should arrive.

**Troubleshooting**
- *"Invalid login" / 535:* you used your normal password or copied the App Password wrong. Create a new one.
- *App Passwords page unavailable:* 2-Step Verification is off, or a work/school admin has disabled it.
- *Sending limits:* a personal Gmail account can send about 500 emails a day. Each reservation uses 2. See [Handling busy days](#handling-busy-days).

</details>

<br>

## ✦ Google Sheets setup

<details>
<summary><b>Step-by-step: connect a sheet in about 5 minutes</b></summary>

<br>

1. **Create a sheet** at <https://sheets.new> (for example `Aurelia Reservations`).
2. **Extensions → Apps Script.** Replace everything in `Code.gs` with [`scripts/google-apps-script.gs`](scripts/google-apps-script.gs).
3. **Set the secret.** Paste the value of `GOOGLE_SHEETS_SECRET` from `.env.local` into `const SECRET = "…"`, then click **Save**.
   *Need a secret?* Run `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (the secret stops anyone else from adding rows)
   - Click **Authorize**. If you see "unverified app", click **Advanced → Go to …**. It's your own script.
5. **Copy the Web app URL** (ends in `/exec`) into `GOOGLE_SHEETS_WEBHOOK_URL`.
6. Run `npm run test:sheet`, then delete the test row it adds.

| Reference | Submitted (IST) | Status | Name | Email | Phone | Date | Time | Guests | Special requests |
|:--|:--|:--|:--|:--|:--|:--|:--|:--:|:--|
| `AUR-7KQ2XD` | 2026-11-19 18:42 | Pending ▾ | … | … | … | 2026-11-28 | 19:30 | 2 | … |

**What the script handles**
- **Columns by name:** you can reorder columns or add your own (e.g. "Table", "Notes from staff"). If you rename or delete a required column, it's added back at the end.
- **Duplicates:** the same email, date and time with an active status isn't added twice, and no second set of emails is sent.
- **Email failures:** if the emails can't be sent, the row's status becomes **Email failed**.
- **Simultaneous bookings:** handled one at a time with `LockService`.
- **Yearly archive:** in the Apps Script editor, run `installYearlyArchive` once (▶ Run). After that, rows from past years move to an `Archive <year>` tab automatically every January. You can also run `archiveOldReservations` by hand at any time.

> [!TIP]
> After editing the script, go to **Deploy → Manage deployments → ✏️ → New version**. Saving alone doesn't update the live web app, and the URL stays the same.

</details>

<br>

## ✦ Limits & scaling

| Concern | Limit | What happens / what to do |
|:--|:--|:--|
| **Email sending** | A personal Gmail account sends ~500 recipients a day over SMTP (a rolling 24 hours). | See [Handling busy days](#handling-busy-days) below. |
| **Sheet size** | 10 million cells per spreadsheet, about **1 million bookings**. | The sheet gets slow long before that (~50k+ rows), so use the yearly archive. |
| **Spam** | n/a | A honeypot, optional Cloudflare Turnstile, and rate limits (5 requests / 10 min per IP, 3 a day per email and per phone) stop bots before they use up your email quota. See [Spam protection](#spam-protection). |
| **Two bookings at once** | n/a | `LockService` writes rows one at a time. |
| **Double booking** | n/a | Each submission is a *request*. The owner confirms availability, so there's no automatic table allocation. |
| **Personal data** | n/a | Name, email and phone are stored in the sheet and the inbox. Keep the sheet **private** (don't share it publicly), and follow India's DPDP Act. |

### Handling busy days

Two settings raise the daily ceiling. They can be combined:

| Setup | Emails per booking | Bookings per day (approx.) |
|:--|:--:|:--|
| Gmail only (default) | 2 | ~250 |
| Gmail + `OWNER_NOTIFY=off` | 1 | ~500 |
| Gmail + Brevo free backup | 2 | ~400 (≈250 Gmail + ≈150 Brevo) |
| Gmail + Brevo free backup + `OWNER_NOTIFY=off` | 1 | ~800 |

**How the backup works:** every email goes through Gmail first. If Gmail rejects it, the same email is retried through the backup. If Gmail says it's over its daily limit, the server skips Gmail and sends straight through the backup for the next hour. The guest only sees an error if **both** providers fail. Then the row is marked **Email failed**.

**With `OWNER_NOTIFY=off`:** you rely on the Google Sheet instead of an email per booking. You still get an email for any booking that couldn't be saved to the sheet, so nothing is missed. If the owner email fails but the booking is in the sheet, the guest still gets their confirmation.

<details>
<summary><b>Set up Brevo as the backup (free, about 300 emails a day)</b></summary>

<br>

1. Create a free account at <https://www.brevo.com> and complete their account check.
2. **Senders, Domains & Dedicated IPs → Senders:** add and verify the address you'll send from. Ideally use one on the café's own domain (e.g. `bookings@cafename.com`, with Brevo's DNS records added). A `@gmail.com` sender through Brevo often lands in spam.
3. **SMTP & API → SMTP:** copy the SMTP login and create an **SMTP key**.
4. Add these to `.env.local`, and to Vercel → Settings → Environment Variables:
   ```ini
   FALLBACK_SMTP_HOST=smtp-relay.brevo.com
   FALLBACK_SMTP_PORT=587
   FALLBACK_SMTP_USER=your-brevo-smtp-login
   FALLBACK_SMTP_PASS=your-brevo-smtp-key
   FALLBACK_FROM_EMAIL=bookings@cafename.com
   ```
5. Run `npm run test:email:fallback`, then redeploy on Vercel.

Brevo's free plan adds a small Brevo logo to emails, and their limits can change. Check their current plan details.

</details>

### Spam protection

Both of these are free and optional, but recommended before going live:

1. **Cloudflare Turnstile** (a privacy-friendly CAPTCHA replacement, usually invisible). In the [Cloudflare dashboard](https://dash.cloudflare.com) → **Turnstile → Add widget**, add your domain (and `localhost` for testing), then set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. Set both or neither. If Cloudflare is ever unreachable, bookings are let through so none are lost, and the rate limits still apply.
2. **Upstash Redis** for the rate limits. On Vercel, each server instance has its own memory, so in-memory limits are easy to get around. Create a free database at [upstash.com](https://upstash.com) (or Vercel → **Storage → Upstash**) and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Only hashed identifiers are stored, never emails or phone numbers.

**Ownership for real clients.** Set everything up on the **client's own** Google account: their Gmail App Password, a sheet in their Drive, and the Apps Script deployed from their account. Ask them for *editor* access so you can maintain it. That way the client owns their data and is never locked out, even if you're unavailable.

<br>

## ✦ Customizing the content

Everything business-specific lives in **two files**, so the site can be rebranded quickly.

| What | Where |
|:--|:--|
| Menu items, prices, bestsellers, new sections (e.g. food) | [`data/menu.ts`](data/menu.ts) |
| Concept banner (turn off for a real café) | [`data/site.ts`](data/site.ts) → `demo.enabled` |
| Name, contact details, address, map coordinates | [`data/site.ts`](data/site.ts) → `contact`, `location` |
| Opening hours and last booking time | [`data/site.ts`](data/site.ts) → `hours` |
| Guest limit, booking window | [`data/site.ts`](data/site.ts) → `reservations` |
| Cancellation, late-arrival and tax policy | [`data/site.ts`](data/site.ts) → `legal` |
| Colors and type | [`app/globals.css`](app/globals.css) → `@theme` |
| Photography | [`public/images/`](public/images) (keep file names, or update the imports) |

<details>
<summary><b>Design system</b></summary>

<br>

| Token | Hex | Use |
|:--|:--|:--|
| Cream | `#FAF9F6` | Primary background |
| Sand | `#F1EEE8` | Secondary background |
| Espresso | `#302820` | Primary text |
| Stone | `#81786E` / `#6F665C` | Secondary text (the darker shade passes WCAG AA) |
| Accent | `#A58A6A` / `#7E6548` | Lines and decoration / small accent text |
| Roast | `#28251F` | Dark sections and footer |

**Type:** Cormorant Garamond (display) · DM Sans (body), loaded with `next/font`.
**Motion:** hero entrance, scroll-linked reveals (progressive enhancement), and `prefers-reduced-motion` respected.

</details>

<br>

## ✦ Project structure

```
app/
├── page.tsx                    Home: all sections
├── layout.tsx                  Fonts, metadata, Open Graph
├── globals.css                 Design tokens + component styles
├── api/reservations/route.ts   Validate → Sheet → Emails
├── privacy-policy/             /privacy-policy
├── terms-and-conditions/       /terms-and-conditions
└── sitemap.ts · robots.ts · icon.svg · not-found.tsx
components/                     Navbar · Hero · About · FeaturedItems · Menu
                                Reservation · Contact · Footer · LegalPage
data/
├── menu.ts                     Menu & prices (single source of truth)
└── site.ts                     Business settings
lib/
├── validation.ts               Shared client/server validation
├── mailer.ts                   Gmail SMTP (server-only)
├── email-templates.ts          HTML + plain-text emails
└── sheets.ts                   Google Sheets via Apps Script
scripts/
├── google-apps-script.gs       Paste into the Google Sheet
├── test-email.mjs              SMTP check
└── test-sheet.mjs              Sheet check
docs/screenshots/               Images used in this README
```

<br>

## ✦ Deploying

Deploy to [Vercel](https://vercel.com/new) (recommended for Next.js) or any Node.js host:

1. Push the repository to GitHub. `.env.local` is excluded automatically.
2. Import it in Vercel.
3. Add every variable from `.env.local` under **Settings → Environment Variables**, with `NEXT_PUBLIC_SITE_URL` set to your live domain.
4. Deploy, then submit a test reservation on the live site.

<br>

## ✦ Before launch

- [x] Gmail SMTP connected and tested
- [x] Google Sheets connected and tested
- [x] Map coordinates · opening hours · cancellation, late-arrival and tax policy
- [ ] Street address (optional): `location.exactAddress`
- [ ] Hosting provider: `legal.hostingProvider` (Privacy Policy)
- [ ] How long reservation records are kept: `legal.retentionPeriod` (Privacy Policy)
- [ ] Review the Privacy Policy and Terms, then set `legal.showDraftNotice` to `false`

<br>

## ✦ Security & privacy

- SMTP and sheet credentials are read **only on the server** (`server-only` imports) and never reach the browser.
- All input is re-validated on the server, and user text is HTML-escaped in emails and protected against spreadsheet formulas in the sheet.
- Spam and abuse: a hidden honeypot field, optional [Cloudflare Turnstile](#spam-protection), and rate limits per IP (5 / 10 minutes) and per email and phone number (3 / day). The per-email limit stops anyone using the form to flood someone else's inbox. Limits are shared across servers when Upstash Redis is configured.
- The API accepts only JSON requests from the site's own pages (Origin check), which blocks cross-site form posts.
- Security headers on every page: Content-Security-Policy, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` (see `next.config.ts`). If you add a third-party script or embed, add its domain to the CSP there.
- If Gmail starts failing and emails go through the backup provider, the owner gets an alert email (at most once every 6 hours).
- No analytics or advertising cookies.

<br>

## ✦ Credits

Photography from [Unsplash](https://unsplash.com), used under the Unsplash License. Replace it with the café's own photos when available.
Icons by [Lucide](https://lucide.dev) · Fonts from [Google Fonts](https://fonts.google.com).

<br>

<div align="center">

**AURELIA**
<br>
<sub>Good coffee. Good food. Good moments.</sub>
<br><br>
<sub>© 2026 Aurelia. All rights reserved.</sub>

</div>
