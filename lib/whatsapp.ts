import "server-only";

/**
 * WhatsApp notifications through the WhatsApp Cloud API (Meta). Optional: everything here is a
 * no-op until WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set.
 *
 * Messages a business starts must use templates approved in WhatsApp Manager. The template
 * names and their {{1}}, {{2}} … body variables are listed in README.md → "WhatsApp setup".
 * Guests only get WhatsApp messages when they ticked the opt-in box on the form.
 * Never throws: email remains the main channel.
 */

const GRAPH_VERSION = "v21.0";
const TIMEOUT_MS = 10_000;

export const WHATSAPP_TEMPLATES = {
  /** To the owner. {{1}} name, {{2}} guests, {{3}} date, {{4}} time, {{5}} phone, {{6}} reference */
  ownerNewBooking: "aurelia_new_booking",
  /** To the owner. {{1}} reference, {{2}} name, {{3}} what happened ("cancelled", "changed to …") */
  ownerBookingChanged: "aurelia_booking_changed",
  /** To the guest. {{1}} name, {{2}} status word, {{3}} date, {{4}} time, {{5}} guests, {{6}} reference */
  guestStatus: "aurelia_booking_status",
  /** To the guest. {{1}} name, {{2}} date, {{3}} time, {{4}} guests, {{5}} reference */
  guestReminder: "aurelia_booking_reminder",
} as const;

function config() {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    ownerNumber: toWhatsAppNumber(process.env.WHATSAPP_OWNER_NUMBER ?? ""),
    language: process.env.WHATSAPP_TEMPLATE_LANG?.trim() || "en",
  };
}

export function whatsappEnabled(): boolean {
  return config() !== null;
}

/**
 * Phone number → WhatsApp ID (country code + number, digits only).
 * 10-digit Indian numbers, with or without a leading 0, get +91. Returns null if it can't be a number.
 */
export function toWhatsAppNumber(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("00")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

/** WhatsApp rejects template variables with newlines, tabs or 4+ spaces in a row. */
function cleanParam(v: string): string {
  return v.replace(/[\r\n\t]+/g, " ").replace(/ {4,}/g, "   ").trim().slice(0, 300) || "-";
}

async function sendTemplate(to: string, template: string, params: string[]): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template,
          language: { code: cfg.language },
          components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text: cleanParam(text) })) }],
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) return true;
    const body = await res.text().catch(() => "");
    console.error(`[whatsapp] ${template} not sent (HTTP ${res.status}):`, body.slice(0, 300));
  } catch (err) {
    console.error(`[whatsapp] ${template} not sent:`, (err as Error)?.message ?? err);
  }
  return false;
}

/** To the owner's WhatsApp number (WHATSAPP_OWNER_NUMBER), if set. */
export async function whatsappOwner(template: string, params: string[]): Promise<boolean> {
  const owner = config()?.ownerNumber;
  return owner ? sendTemplate(owner, template, params) : false;
}

/** To a guest. Callers must check the guest opted in. */
export async function whatsappGuest(phone: string, template: string, params: string[]): Promise<boolean> {
  const to = toWhatsAppNumber(phone);
  return to ? sendTemplate(to, template, params) : false;
}
