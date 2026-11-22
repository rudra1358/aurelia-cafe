"use client";

import { useActionState } from "react";
import { LoaderCircle, Lock } from "lucide-react";
import { login } from "@/app/admin/actions";
import { site } from "@/data/site";

export default function AdminLogin() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="adm-card adm-narrow">
      <p className="eyebrow text-accent-ink">{site.name} · Owner admin</p>
      <h1 className="adm-h1">Sign in</h1>
      <p className="adm-muted">Only the owner can edit the menu and events. Guests never see this page.</p>
      <label className="adm-field">
        <span>Password</span>
        <input type="password" name="password" required autoComplete="current-password" autoFocus maxLength={200} />
      </label>
      {state?.error && (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-dark" disabled={pending} style={{ width: "100%" }}>
        {pending ? <LoaderCircle size={16} className="spin" aria-hidden /> : <Lock size={14} strokeWidth={1.5} aria-hidden />}
        Sign in
      </button>
    </form>
  );
}
