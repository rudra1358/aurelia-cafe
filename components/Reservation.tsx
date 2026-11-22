"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Script from "next/script";
import { Check, ChevronDown, CircleAlert, Clock, Info, LoaderCircle } from "lucide-react";
import cheers from "@/public/images/cheers.jpg";
import { site, telHref } from "@/data/site";
import { upcomingEvents, type CafeEvent } from "@/data/events";
import { formatDate, formatTime } from "@/lib/format";
import { trackBookingRequested, trackBookingStarted } from "@/lib/analytics";
import { useT } from "./Language";
import {
  addDays,
  closedDateMessage,
  closedWeekdaysText,
  nowInCafeTimeZone,
  reservationFields,
  validateReservation,
  type ReservationErrors,
  type ReservationField,
  type ReservationInput,
} from "@/lib/validation";

type Status = "idle" | "submitting" | "success" | "error";

/** Cloudflare Turnstile spam check — shown only when a site key is configured. */
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";
const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** Show the "updates on WhatsApp" opt-in. Set once WhatsApp is set up (README → WhatsApp setup). */
const WHATSAPP_OPT_IN = process.env.NEXT_PUBLIC_WHATSAPP_OPT_IN?.trim() === "true";

const empty: ReservationInput = {
  event: "",
  name: "",
  email: "",
  phone: "",
  date: "",
  time: "",
  guests: "",
  notes: "",
  whatsapp: "",
};

/** `eventList` is the owner's saved events (/admin); past ones are filtered out here. */
export default function Reservation({ eventList }: { eventList: CafeEvent[] }) {
  const t = useT();
  const [values, setValues] = useState<ReservationInput>(empty);
  const [errors, setErrors] = useState<ReservationErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [submitted, setSubmitted] = useState<{
    firstName: string;
    email: string;
    duplicate?: boolean;
    reference?: string;
    /** For a duplicate: when the existing request is for. */
    existing?: { date?: string; time?: string };
    /** The request reached us, but the guest's confirmation email failed. */
    emailFailed?: boolean;
  } | null>(null);
  const [minDate, setMinDate] = useState<string>();
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const turnstileBox = useRef<HTMLDivElement>(null);
  const turnstileId = useRef<string | null>(null);
  const turnstileToken = useRef("");
  /** True when Turnstile reported an error (e.g. domain not allowed, script blocked) — waiting won't help. */
  const turnstileFailed = useRef(false);
  const [turnstileReady, setTurnstileReady] = useState(false);
  /** "Booking started" is sent once per page view, on the first keystroke or pick. */
  const startedTracked = useRef(false);

  // Computed on the client to avoid a server/client date mismatch during hydration, and kept
  // current so a tab left open past midnight doesn't offer yesterday.
  useEffect(() => {
    const refresh = () => setMinDate(nowInCafeTimeZone().date);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Events open for booking (computed on the client, like minDate).
  const events = minDate ? upcomingEvents(minDate, eventList) : [];
  const selectedEvent = events.find((e) => e.id === values.event) ?? null;

  // "Book a seat" links arrive as /?event=<id>#reservation: pre-select that event.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    const ev = upcomingEvents(nowInCafeTimeZone().date, eventList).find((e) => e.id === id);
    // The URL is only known in the browser, so this runs after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ev) setValues((v) => ({ ...v, event: ev.id, date: ev.date, time: ev.time }));
  }, [eventList]);

  const chooseEvent = (id: string) => {
    const ev = events.find((e) => e.id === id);
    setValues((v) => ({ ...v, event: id, ...(ev ? { date: ev.date, time: ev.time } : { date: "", time: "" }) }));
    setErrors((er) => ({ ...er, event: undefined, date: undefined, time: undefined }));
  };
  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  // Render the Turnstile widget whenever the form is on screen (it unmounts on success).
  const formShown = status !== "success";
  useEffect(() => {
    const el = turnstileBox.current;
    if (!TURNSTILE_SITE_KEY || !turnstileReady || !formShown || !el || !window.turnstile) return;
    const api = window.turnstile;
    const id = api.render(el, {
      sitekey: TURNSTILE_SITE_KEY,
      appearance: "interaction-only", // invisible unless Cloudflare needs the visitor to click
      theme: "light",
      size: "flexible",
      callback: (token: string) => {
        turnstileToken.current = token;
        turnstileFailed.current = false;
      },
      "expired-callback": () => {
        turnstileToken.current = "";
      },
      "error-callback": (code: string) => {
        turnstileToken.current = "";
        turnstileFailed.current = true;
        console.warn(`[reservation] Security check failed (Cloudflare Turnstile error ${code}).`);
      },
    });
    turnstileId.current = id;
    return () => {
      api.remove(id);
      turnstileId.current = null;
      turnstileToken.current = "";
    };
  }, [turnstileReady, formShown]);

  /** Tokens are single-use: get a fresh one after every submission attempt. */
  const resetTurnstile = () => {
    turnstileToken.current = "";
    if (turnstileId.current && window.turnstile) window.turnstile.reset(turnstileId.current);
  };

  const onChange = (field: ReservationField) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    if (!startedTracked.current) {
      startedTracked.current = true;
      trackBookingStarted();
    }
    // Tell the visitor straight away when they pick a day the café is closed.
    const closed = field === "date" && value ? closedDateMessage(value) : null;
    if (closed) setErrors((er) => ({ ...er, date: closed }));
    else if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
    if (status === "error") setStatus("idle");
  };

  const focusFirstError = (errs: ReservationErrors) => {
    const first = reservationFields.find((f) => errs[f]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return; // duplicate-submission guard

    const check = validateReservation(values, nowInCafeTimeZone(), eventList);
    if (!check.ok) {
      setErrors(check.errors);
      focusFirstError(check.errors);
      return;
    }

    if (TURNSTILE_SITE_KEY && !turnstileToken.current) {
      setServerMessage(
        turnstileFailed.current || !window.turnstile
          ? "Our security check couldn’t run in your browser, so we can’t send your request online. Refreshing the page (or turning off an ad blocker) may help."
          : "Our security check hasn’t finished yet. Please wait a few seconds and press the button again.",
      );
      setStatus("error");
      return;
    }

    inFlight.current = true;
    setStatus("submitting");
    setServerMessage("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          company: honeypot.current?.value ?? "",
          turnstileToken: turnstileToken.current,
        }),
      });
      const data: {
        ok?: boolean;
        error?: string;
        errors?: ReservationErrors;
        duplicate?: boolean;
        reference?: string;
        existing?: { date?: string; time?: string };
        emailFailed?: boolean;
      } = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        trackBookingRequested({ kind: check.data.event ? "event" : "table", guests: check.data.guests, duplicate: !!data.duplicate });
        setSubmitted({
          firstName: check.data.name.split(" ")[0],
          email: check.data.email,
          duplicate: !!data.duplicate,
          reference: data.reference,
          existing: data.existing,
          emailFailed: !!data.emailFailed,
        });
        setValues(empty);
        setErrors({});
        setStatus("success");
        return;
      }
      if (res.status === 422 && data.errors) {
        setErrors(data.errors);
        setStatus("idle");
        focusFirstError(data.errors);
        return;
      }
      setServerMessage(data.error ?? "");
      setStatus("error");
    } catch {
      setServerMessage("");
      setStatus("error");
    } finally {
      inFlight.current = false;
      resetTurnstile();
    }
  }

  const fieldClass = (f: ReservationField, extra = "") => `fld${errors[f] ? " bad" : ""}${extra ? ` ${extra}` : ""}`;
  const a11y = (f: ReservationField, describedBy?: string) => ({
    id: `r-${f}`,
    name: f,
    "aria-invalid": errors[f] ? true : undefined,
    "aria-describedby": [errors[f] ? `r-${f}-err` : "", describedBy ?? ""].filter(Boolean).join(" ") || undefined,
    onChange: onChange(f),
    value: values[f],
  });
  const err = (f: ReservationField) =>
    errors[f] ? (
      <p className="ferr" id={`r-${f}-err`}>
        {errors[f]}
      </p>
    ) : null;

  const loading = status === "submitting";
  const { maxGuests, maxNotesLength, maxDaysAhead, slotMinutes } = site.reservations;
  const closedText = closedWeekdaysText();

  return (
    <section className="sec res" id="reservation" aria-labelledby="res-title">
      {TURNSTILE_SITE_KEY && (
        <Script
          src={TURNSTILE_SRC}
          strategy="afterInteractive"
          onReady={() => setTurnstileReady(true)}
          onError={() => {
            turnstileFailed.current = true;
          }}
        />
      )}
      <div className="wrap g12">
        <div className="res-l">
          <p className="eyebrow reveal">{t("res.eyebrow")}</p>
          <h2 className="h2 reveal" id="res-title" style={{ marginTop: 22 }}>
            {t("res.title")}
          </h2>
          <p className="res-sub reveal">{t("res.sub")}</p>
          <div className="res-img">
            <figure className="frame unveil">
              <Image
                src={cheers}
                alt="Friends raising cups of coffee with latte art together over a table"
                fill
                sizes="(max-width: 900px) 100vw, 38vw"
                placeholder="blur"
              />
            </figure>
          </div>
          <div className="res-note">
            <Info size={18} strokeWidth={1.4} aria-hidden />
            <p style={{ margin: 0 }}>{t("res.note")}</p>
          </div>
          {(site.legal.cancellationPolicy || site.legal.lateArrivalPolicy) && (
            <div className="res-note" style={{ marginTop: 16 }}>
              <Clock size={18} strokeWidth={1.4} aria-hidden />
              <p style={{ margin: 0 }}>
                {t("res.open", { hours: site.hours.display })} {site.legal.cancellationPolicy} {site.legal.lateArrivalPolicy}
              </p>
            </div>
          )}
        </div>

        <div className="res-r">
          {status === "success" && submitted ? (
            <div className="done" role="status" tabIndex={-1} ref={successRef} style={{ outline: "none" }}>
              <div className="ring">
                <Check size={22} strokeWidth={1.4} aria-hidden />
              </div>
              <h3>{t("res.thanks", { name: submitted.firstName })}</h3>
              {submitted.duplicate ? (
                <p>
                  We already have your request
                  {submitted.existing?.date && submitted.existing?.time
                    ? ` for ${formatDate(submitted.existing.date)} at ${formatTime(submitted.existing.time)}`
                    : " for around this time"}
                  {submitted.reference ? ` (reference ${submitted.reference})` : ""}, so there’s no need to send it again. To
                  change it, please call us on <a href={telHref}>{site.contact.phoneDisplay}</a>.
                </p>
              ) : submitted.emailFailed ? (
                <p>
                  Your reservation request has been received
                  {submitted.reference ? ` (reference ${submitted.reference})` : ""}, but we couldn’t send the confirmation
                  email to <strong style={{ fontWeight: 500, color: "#FAF9F6" }}>{submitted.email}</strong>. There’s no need to
                  send it again — our team will contact you by phone.
                </p>
              ) : (
                <p>
                  {t("res.received")} <strong style={{ fontWeight: 500, color: "#FAF9F6" }}>{submitted.email}</strong>
                  {submitted.reference ? ` (${submitted.reference})` : ""}.
                </p>
              )}
              <p>{t("res.pending")}</p>
              <button className="btn btn-ghost" type="button" style={{ marginTop: 40 }} onClick={() => setStatus("idle")}>
                {t("res.another")}
              </button>
            </div>
          ) : (
            <form ref={formRef} noValidate onSubmit={onSubmit} aria-labelledby="res-title" aria-busy={loading}>
              {/* Spam trap: hidden from people, often filled by bots. */}
              <div className="hp" aria-hidden>
                <label htmlFor="r-company">Company</label>
                <input ref={honeypot} id="r-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              <fieldset disabled={loading}>
                <legend className="eyebrow">{t("res.details")}</legend>
                <div className="fgrid">
                  <div className={fieldClass("name", "span2")}>
                    <label htmlFor="r-name">{t("res.name")}</label>
                    <input className="inp" type="text" autoComplete="name" placeholder={t("res.namePh")} required maxLength={100} {...a11y("name")} />
                    {err("name")}
                  </div>
                  <div className={fieldClass("email")}>
                    <label htmlFor="r-email">{t("res.email")}</label>
                    <input className="inp" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required maxLength={254} {...a11y("email")} />
                    {err("email")}
                  </div>
                  <div className={fieldClass("phone")}>
                    <label htmlFor="r-phone">{t("res.phone")}</label>
                    <input className="inp" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" required maxLength={20} {...a11y("phone")} />
                    {err("phone")}
                  </div>
                  {WHATSAPP_OPT_IN && (
                    <div className="fld span2 fcheck">
                      <input
                        id="r-whatsapp"
                        name="whatsapp"
                        type="checkbox"
                        checked={values.whatsapp === "yes"}
                        onChange={(e) => setValues((v) => ({ ...v, whatsapp: e.target.checked ? "yes" : "" }))}
                      />
                      <label htmlFor="r-whatsapp">{t("res.whatsapp")}</label>
                    </div>
                  )}
                </div>
              </fieldset>

              <fieldset disabled={loading} style={{ marginTop: 56 }}>
                <legend className="eyebrow">{t("res.visit")}</legend>
                <div className="fgrid">
                  {events.length > 0 && (
                    <div className={fieldClass("event", "span2")}>
                      <label htmlFor="r-event">{t("res.event")}</label>
                      <select
                        className="inp"
                        id="r-event"
                        name="event"
                        value={values.event}
                        onChange={(e) => chooseEvent(e.target.value)}
                        aria-invalid={errors.event ? true : undefined}
                        aria-describedby={errors.event ? "r-event-err" : selectedEvent ? "r-event-hint" : undefined}
                      >
                        <option value="">{t("res.eventNone")}</option>
                        {events.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.title} — {formatDate(ev.date)}, {formatTime(ev.time)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="chev" size={14} strokeWidth={1.5} aria-hidden />
                      {err("event")}
                      {selectedEvent && (
                        <p className="fhint" id="r-event-hint">
                          {t("res.eventSet", { date: formatDate(selectedEvent.date), time: formatTime(selectedEvent.time) })}
                          {selectedEvent.price ? ` ${selectedEvent.price}.` : ""}
                        </p>
                      )}
                    </div>
                  )}
                  {!selectedEvent && (
                  <>
                  <div className={fieldClass("date")}>
                    <label htmlFor="r-date">{t("res.date")}</label>
                    <input
                      className="inp"
                      type="date"
                      required
                      min={minDate}
                      max={minDate ? addDays(minDate, maxDaysAhead) : undefined}
                      onFocus={() => setMinDate(nowInCafeTimeZone().date)}
                      {...a11y("date", closedText ? "r-date-hint" : undefined)}
                    />
                    {err("date")}
                    {closedText && (
                      <p className="fhint" id="r-date-hint">
                        {closedText}
                      </p>
                    )}
                  </div>
                  <div className={fieldClass("time")}>
                    <label htmlFor="r-time">{t("res.time")}</label>
                    <input
                      className="inp"
                      type="time"
                      required
                      min={site.hours.open}
                      max={site.hours.lastReservation}
                      step={slotMinutes * 60}
                      {...a11y("time", "r-time-hint")}
                    />
                    {err("time")}
                    <p className="fhint" id="r-time-hint">
                      {t("res.timeHint", {
                        from: formatTime(site.hours.open),
                        to: formatTime(site.hours.lastReservation),
                        step: slotMinutes,
                      })}
                    </p>
                  </div>
                  </>
                  )}
                  <div className={fieldClass("guests", "span2")}>
                    <label htmlFor="r-guests">{t("res.guests")}</label>
                    <select className="inp" required {...a11y("guests", "r-guests-hint")}>
                      <option value="">{t("res.selectGuests")}</option>
                      {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? t("res.guest") : t("res.guestsWord")}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="chev" size={14} strokeWidth={1.5} aria-hidden />
                    {err("guests")}
                    <p className="fhint" id="r-guests-hint">
                      {t("res.groups", { max: maxGuests })}{" "}
                      <a className="inline" href={telHref}>
                        {site.contact.phoneDisplay}
                      </a>
                      .
                    </p>
                  </div>
                  <div className={fieldClass("notes", "span2")}>
                    <label htmlFor="r-notes">
                      {t("res.notes")} <span className="opt">{t("res.optional")}</span>
                    </label>
                    <textarea
                      className="inp"
                      rows={3}
                      maxLength={maxNotesLength}
                      placeholder={t("res.notesPh")}
                      {...a11y("notes")}
                    />
                    {err("notes")}
                  </div>
                </div>
              </fieldset>

              {TURNSTILE_SITE_KEY && <div ref={turnstileBox} className="turnstile" />}

              {status === "error" && (
                <div className="alert" role="alert">
                  <CircleAlert size={18} strokeWidth={1.4} aria-hidden style={{ flex: "none", marginTop: 2 }} />
                  <p>
                    {serverMessage || "We couldn’t send your request just now, so it hasn’t reached us."} Please try again in a
                    moment, or call us on <a href={telHref}>{site.contact.phoneDisplay}</a>.
                  </p>
                </div>
              )}

              <div className="fbar">
                <p>
                  {t("res.agree")}{" "}
                  <a className="inline" href="/privacy-policy">
                    {t("res.privacy")}
                  </a>{" "}
                  {t("res.and")}{" "}
                  <a className="inline" href="/terms-and-conditions">
                    {t("res.terms")}
                  </a>
                  .
                </p>
                <button className="btn btn-sub" type="submit" disabled={loading}>
                  {loading && <LoaderCircle className="spin" size={15} strokeWidth={1.6} aria-hidden />}
                  {loading ? t("res.sending") : t("res.submit")}
                </button>
              </div>
              <p className="sr-only-live" aria-live="polite">
                {loading ? "Sending your reservation request." : status === "error" ? "Your request could not be sent." : ""}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
