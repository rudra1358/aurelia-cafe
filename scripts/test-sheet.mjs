// Sends ONE clearly-marked test row to your Google Sheet. Delete the row afterwards.
// Usage:  npm run test:sheet      (reads .env.local)
const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
const secret = process.env.GOOGLE_SHEETS_SECRET?.trim();

if (!url || !secret) {
  console.error("✗ GOOGLE_SHEETS_WEBHOOK_URL and GOOGLE_SHEETS_SECRET must be set in .env.local");
  process.exit(1);
}
if (!url.endsWith("/exec")) {
  console.warn("! The web app URL usually ends in /exec — check you copied the Web app URL, not the editor URL.");
}

const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]),
);

const reservation = {
  reference: "AUR-TEST01",
  submittedAt: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
  name: "TEST — delete this row",
  email: "test@example.com",
  phone: "+91 00000 00000",
  date: `${parts.year}-${parts.month}-${parts.day}`,
  time: "19:30",
  guests: 2,
  notes: "Test row from npm run test:sheet",
};

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, reservation }),
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (res.ok && data.ok) {
    console.log("✓ Test row added to the 'Reservations' tab of your sheet. You can delete it now.");
  } else if (data.error === "unauthorized") {
    console.error("✗ The sheet rejected the secret. SECRET in the Apps Script must exactly match GOOGLE_SHEETS_SECRET, and you must deploy a NEW version after changing it.");
    process.exitCode = 1;
  } else {
    console.error(`✗ Unexpected reply (HTTP ${res.status}): ${data.error ?? text.slice(0, 200)}`);
    console.error("  → Check the deployment is a Web app with 'Who has access: Anyone'.");
    process.exitCode = 1;
  }
} catch (err) {
  console.error("✗ Could not reach the web app:", err.message);
  process.exitCode = 1;
}
