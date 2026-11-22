import type { Metadata } from "next";
import { adminSetup, isAdmin, MIN_PASSWORD_LENGTH } from "@/lib/admin-auth";
import { contentBackend, loadContentFresh } from "@/lib/content-store";
import { nowInCafeTimeZone } from "@/lib/validation";
import AdminEditor from "@/components/admin/AdminEditor";
import AdminLogin from "@/components/admin/AdminLogin";
import { site } from "@/data/site";
import { menu as defaultMenu } from "@/data/menu";

/**
 * Owner admin: edit the menu and events. Not linked from anywhere on the site, hidden from
 * search engines, and every change needs the owner password (ADMIN_PASSWORD).
 */
export const metadata: Metadata = {
  title: "Owner admin",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="adm">
      <div className="adm-wrap">{children}</div>
    </main>
  );
}

export default async function AdminPage() {
  const setup = adminSetup();
  if (setup !== "ok") {
    return (
      <Shell>
        <div className="adm-card adm-narrow">
          <p className="eyebrow text-accent-ink">{site.name} · Owner admin</p>
          <h1 className="adm-h1">Admin is switched off</h1>
          <p>
            {setup === "missing"
              ? "To turn it on, add an ADMIN_PASSWORD environment variable"
              : `ADMIN_PASSWORD is too short. Use at least ${MIN_PASSWORD_LENGTH} characters`}{" "}
            (in <code>.env.local</code>, or Vercel → Project → Settings → Environment Variables), then restart or redeploy.
          </p>
        </div>
      </Shell>
    );
  }

  if (!(await isAdmin())) {
    return (
      <Shell>
        <AdminLogin />
      </Shell>
    );
  }

  const backend = contentBackend();
  let content = null;
  let loadError: string | null = null;
  try {
    content = await loadContentFresh();
  } catch (err) {
    console.error("[admin] Could not load content:", err);
    loadError = err instanceof Error ? err.message : String(err);
  }

  return (
    <Shell>
      {content ? (
        <AdminEditor initial={content} starting={defaultMenu} backend={backend} today={nowInCafeTimeZone().date} demo={site.demo.enabled} />
      ) : (
        <div className="adm-card adm-narrow">
          <h1 className="adm-h1">Couldn’t load the menu</h1>
          <p>The storage didn’t answer, so nothing can be edited right now (to avoid overwriting anything). Please reload in a minute.</p>
          <p className="adm-muted">{loadError}</p>
        </div>
      )}
    </Shell>
  );
}
