"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import { site, telHref } from "@/data/site";
import { formatDate, formatGuests, formatTime } from "@/lib/format";
import { addDays, closedDateMessage, nowInCafeTimeZone } from "@/lib/validation";

export interface ManageView {
  reference: string;
  status: string;
  date: string;
  time: string;
  guests: number;
  event: string;
  canCancel: boolean;
  canChange: boolean;
  reason?: string;
}

type Mode = "view" | "change" | "cancel";
type FieldErrors = Partial<Record<"date" | "time" | "guests", string>>;

const STATUS_TEXT: Record<string, string> = {
  Pending: "Awaiting confirmation",
  "Guest not emailed": "Awaiting confirmation",
  Confirmed: "Confirmed",
  Declined: "Not available",
  Cancelled: "Cancelled",
  Completed: "Completed",
  "No-show": "Missed",
};

export default function ManageBooking({ token, initial, firstName }: { token: string; initial: ManageView; firstName: string }) {
  const [b, setB] = useState(initial);
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ date: initial.date, time: initial.time, guests: String(initial.guests) });
  const [today, setToday] = useState<string>();
  // "Today" is read in the browser after hydration so a cached server render never shows a stale date.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToday(nowInCafeTimeZone().date), []);

  const { maxGuests, maxDaysAhead, slotMinutes } = site.reservations;

  async function send(action: "cancel" | "change") {
    setBusy(true);
    setError("");
    setErrors({});
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: b.reference, token, action, ...(action === "change" ? form : {}) }),
      });
      const data: { ok?: boolean; error?: string; errors?: FieldErrors; booking?: ManageView; emailed?: boolean } = await res
        .json()
        .catch(() => ({}));
      if (data.booking) setB(data.booking);
      if (res.ok && data.ok) {
        setMode("view");
        setNotice(
          action === "cancel"
            ? `Your booking is cancelled.${data.emailed ? " We’ve emailed you a confirmation." : ""}`
            : `Thanks — we’ve updated your request.${data.emailed ? " We’ve emailed you the details," : ""} and we’ll email you again once it’s confirmed.`,
        );
        return;
      }
      if (data.errors) setErrors(data.errors);
      else setError(data.error || "Something went wrong. Please try again, or call us.");
    } catch {
      setError("We couldn’t reach the website. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const onChangeSubmit = (e: FormEvent) => {
    e.preventDefault();
    const closed = form.date ? closedDateMessage(form.date) : null;
    if (closed) return setErrors({ date: closed });
    void send("change");
  };

  return (
    <div className="mb">
      <p className="mb-hi">Hello {firstName} — here are your booking details.</p>
      <dl className="mb-dl">
        <div>
          <dt>Reference</dt>
          <dd>{b.reference}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{STATUS_TEXT[b.status] ?? b.status}</dd>
        </div>
        {b.event && (
          <div>
            <dt>Event</dt>
            <dd>{b.event}</dd>
          </div>
        )}
        <div>
          <dt>When</dt>
          <dd>
            {formatDate(b.date)}, {formatTime(b.time)}
          </dd>
        </div>
        <div>
          <dt>Guests</dt>
          <dd>{formatGuests(b.guests)}</dd>
        </div>
      </dl>

      {notice && (
        <p className="mb-notice" role="status">
          {notice}
        </p>
      )}
      {b.reason && <p className="mb-reason">{b.reason}</p>}

      {mode === "view" && (b.canChange || b.canCancel) && (
        <div className="mb-actions">
          {b.canChange && (
            <button className="btn btn-sub" type="button" onClick={() => (setMode("change"), setNotice(""))}>
              Change date, time or guests
            </button>
          )}
          {b.canCancel && (
            <button className="btn btn-ghost" type="button" onClick={() => (setMode("cancel"), setNotice(""))}>
              Cancel booking
            </button>
          )}
        </div>
      )}

      {mode === "cancel" && (
        <div className="mb-panel">
          <p>
            Cancel your booking for {formatGuests(b.guests)} on {formatDate(b.date)} at {formatTime(b.time)}? This can’t be undone
            online.
          </p>
          <div className="mb-actions">
            <button className="btn btn-sub" type="button" disabled={busy} onClick={() => send("cancel")}>
              {busy && <LoaderCircle className="spin" size={15} strokeWidth={1.6} aria-hidden />}
              Yes, cancel it
            </button>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setMode("view")}>
              Keep my booking
            </button>
          </div>
        </div>
      )}

      {mode === "change" && (
        <form className="mb-panel" noValidate onSubmit={onChangeSubmit}>
          <p>Choose a new date, time or number of guests. The change goes back to us to confirm.</p>
          <fieldset disabled={busy}>
            <div className="fgrid" style={{ marginTop: 32 }}>
              <div className={`fld${errors.date ? " bad" : ""}`}>
                <label htmlFor="m-date">Date</label>
                <input
                  id="m-date"
                  className="inp"
                  type="date"
                  value={form.date}
                  min={today}
                  max={today ? addDays(today, maxDaysAhead) : undefined}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  aria-invalid={errors.date ? true : undefined}
                  aria-describedby={errors.date ? "m-date-err" : undefined}
                />
                {errors.date && (
                  <p className="ferr" id="m-date-err">
                    {errors.date}
                  </p>
                )}
              </div>
              <div className={`fld${errors.time ? " bad" : ""}`}>
                <label htmlFor="m-time">Time</label>
                <input
                  id="m-time"
                  className="inp"
                  type="time"
                  value={form.time}
                  min={site.hours.open}
                  max={site.hours.lastReservation}
                  step={slotMinutes * 60}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  aria-invalid={errors.time ? true : undefined}
                  aria-describedby={errors.time ? "m-time-err" : "m-time-hint"}
                />
                {errors.time ? (
                  <p className="ferr" id="m-time-err">
                    {errors.time}
                  </p>
                ) : (
                  <p className="fhint" id="m-time-hint">
                    {formatTime(site.hours.open)} – {formatTime(site.hours.lastReservation)}, every {slotMinutes} minutes
                  </p>
                )}
              </div>
              <div className={`fld span2${errors.guests ? " bad" : ""}`}>
                <label htmlFor="m-guests">Guests</label>
                <select
                  id="m-guests"
                  className="inp"
                  value={form.guests}
                  onChange={(e) => setForm((f) => ({ ...f, guests: e.target.value }))}
                  aria-invalid={errors.guests ? true : undefined}
                >
                  {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {formatGuests(n)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="chev" size={14} strokeWidth={1.5} aria-hidden />
                {errors.guests && <p className="ferr">{errors.guests}</p>}
              </div>
            </div>
          </fieldset>
          <div className="mb-actions">
            <button className="btn btn-sub" type="submit" disabled={busy}>
              {busy && <LoaderCircle className="spin" size={15} strokeWidth={1.6} aria-hidden />}
              {busy ? "Saving…" : "Save change"}
            </button>
            <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => setMode("view")}>
              Back
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="alert" role="alert">
          <CircleAlert size={18} strokeWidth={1.4} aria-hidden style={{ flex: "none", marginTop: 2 }} />
          <p>{error}</p>
        </div>
      )}

      <p className="mb-help">
        Questions? Call us on <a href={telHref}>{site.contact.phoneDisplay}</a> or reply to any of our emails.
      </p>
    </div>
  );
}
