"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Script from "next/script";
import { Check, ChevronDown, CircleAlert, Clock, Info, LoaderCircle } from "lucide-react";
import cheers from "@/public/images/cheers.jpg";
import { site, telHref } from "@/data/site";
import { formatTime } from "@/lib/format";
import {
  addDays,
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

const empty: ReservationInput = { name: "", email: "", phone: "", date: "", time: "", guests: "", notes: "" };

export default function Reservation() {
  const [values, setValues] = useState<ReservationInput>(empty);
  const [errors, setErrors] = useState<ReservationErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [submitted, setSubmitted] = useState<{
    firstName: string;
    email: string;
    duplicate?: boolean;
    reference?: string;
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

  // Computed on the client to avoid a server/client date mismatch during hydration.
  useEffect(() => setMinDate(nowInCafeTimeZone().date), []);
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
    if (errors[field]) setErrors((er) => ({ ...er, [field]: undefined }));
    if (status === "error") setStatus("idle");
  };

  const focusFirstError = (errs: ReservationErrors) => {
    const first = reservationFields.find((f) => errs[f]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return; // duplicate-submission guard

    const check = validateReservation(values);
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
      const data: { ok?: boolean; error?: string; errors?: ReservationErrors; duplicate?: boolean; reference?: string } =
        await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setSubmitted({
          firstName: check.data.name.split(" ")[0],
          email: check.data.email,
          duplicate: !!data.duplicate,
          reference: data.reference,
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
  const { maxGuests, maxNotesLength, maxDaysAhead } = site.reservations;

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
          <p className="eyebrow reveal">Reservations</p>
          <h2 className="h2 reveal" id="res-title" style={{ marginTop: 22 }}>
            Your table is waiting.
          </h2>
          <p className="res-sub reveal">Make a reservation and let us take care of the rest.</p>
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
            <p style={{ margin: 0 }}>
              This form sends a reservation <em>request</em>. Your table is confirmed only once our team contacts you to
              confirm availability.
            </p>
          </div>
          {(site.legal.cancellationPolicy || site.legal.lateArrivalPolicy) && (
            <div className="res-note" style={{ marginTop: 16 }}>
              <Clock size={18} strokeWidth={1.4} aria-hidden />
              <p style={{ margin: 0 }}>
                Open {site.hours.display}. {site.legal.cancellationPolicy} {site.legal.lateArrivalPolicy}
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
              <h3>Thank you, {submitted.firstName}.</h3>
              {submitted.duplicate ? (
                <p>
                  We already have your request for this date and time
                  {submitted.reference ? ` (reference ${submitted.reference})` : ""}, so there’s no need to send it again.
                  Its summary was sent to <strong style={{ fontWeight: 500, color: "#FAF9F6" }}>{submitted.email}</strong>.
                </p>
              ) : (
                <p>
                  Your reservation request has been received, and a summary has been sent to{" "}
                  <strong style={{ fontWeight: 500, color: "#FAF9F6" }}>{submitted.email}</strong>.
                </p>
              )}
              <p>Please note this is not yet a confirmed booking — our team will contact you shortly to confirm availability.</p>
              <button className="btn btn-ghost" type="button" style={{ marginTop: 40 }} onClick={() => setStatus("idle")}>
                Make another request
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
                <legend className="eyebrow">Your details</legend>
                <div className="fgrid">
                  <div className={fieldClass("name", "span2")}>
                    <label htmlFor="r-name">Full name</label>
                    <input className="inp" type="text" autoComplete="name" placeholder="Your full name" required maxLength={100} {...a11y("name")} />
                    {err("name")}
                  </div>
                  <div className={fieldClass("email")}>
                    <label htmlFor="r-email">Email address</label>
                    <input className="inp" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" required maxLength={254} {...a11y("email")} />
                    {err("email")}
                  </div>
                  <div className={fieldClass("phone")}>
                    <label htmlFor="r-phone">Phone number</label>
                    <input className="inp" type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" required maxLength={20} {...a11y("phone")} />
                    {err("phone")}
                  </div>
                </div>
              </fieldset>

              <fieldset disabled={loading} style={{ marginTop: 56 }}>
                <legend className="eyebrow">Your visit</legend>
                <div className="fgrid">
                  <div className={fieldClass("date")}>
                    <label htmlFor="r-date">Reservation date</label>
                    <input
                      className="inp"
                      type="date"
                      required
                      min={minDate}
                      max={minDate ? addDays(minDate, maxDaysAhead) : undefined}
                      {...a11y("date")}
                    />
                    {err("date")}
                  </div>
                  <div className={fieldClass("time")}>
                    <label htmlFor="r-time">Preferred time</label>
                    <input
                      className="inp"
                      type="time"
                      required
                      min={site.hours.open}
                      max={site.hours.lastReservation}
                      step={900}
                      {...a11y("time", "r-time-hint")}
                    />
                    {err("time")}
                    <p className="fhint" id="r-time-hint">
                      {formatTime(site.hours.open)} – {formatTime(site.hours.lastReservation)}
                    </p>
                  </div>
                  <div className={fieldClass("guests", "span2")}>
                    <label htmlFor="r-guests">Number of guests</label>
                    <select className="inp" required {...a11y("guests", "r-guests-hint")}>
                      <option value="">Select guests</option>
                      {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "guest" : "guests"}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="chev" size={14} strokeWidth={1.5} aria-hidden />
                    {err("guests")}
                    <p className="fhint" id="r-guests-hint">
                      For groups larger than {maxGuests}, please call us on{" "}
                      <a className="inline" href={telHref}>
                        {site.contact.phoneDisplay}
                      </a>
                      .
                    </p>
                  </div>
                  <div className={fieldClass("notes", "span2")}>
                    <label htmlFor="r-notes">
                      Special requests <span className="opt">(optional)</span>
                    </label>
                    <textarea
                      className="inp"
                      rows={3}
                      maxLength={maxNotesLength}
                      placeholder="Celebrations, seating preferences, dietary notes…"
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
                  By submitting, you agree to our{" "}
                  <a className="inline" href="/privacy-policy">
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a className="inline" href="/terms-and-conditions">
                    Terms
                  </a>
                  .
                </p>
                <button className="btn btn-sub" type="submit" disabled={loading}>
                  {loading && <LoaderCircle className="spin" size={15} strokeWidth={1.6} aria-hidden />}
                  {loading ? "Sending request…" : "Request reservation"}
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
