import { Info } from "lucide-react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { site } from "@/data/site";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

export function OwnerReview({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <span className="owner">Owner review</span>
      {children}
    </>
  );
}

export default function LegalPage({
  title,
  notice,
  sections,
}: {
  title: string;
  notice: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div id="top">
      <Navbar variant="solid" />
      <main id="main">
        <div className="wrap">
          <div className="lg-head">
            <p className="eyebrow text-accent-ink">Legal</p>
            <h1>{title}</h1>
            <div className="lg-meta">
              <span>Last updated: {site.legal.lastUpdated}</span>
              <span>Applies to: the Aurelia website and reservation requests</span>
            </div>
            {site.legal.showDraftNotice && (
              <div className="lg-review" role="note">
                <Info size={18} strokeWidth={1.4} aria-hidden />
                <p>{notice}</p>
              </div>
            )}
          </div>

          <div className="lg-body">
            <nav className="toc" aria-label="Sections">
              <p className="eyebrow text-accent-ink">Contents</p>
              <ol>
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <article className="lg-content">
              {sections.map((s, i) => (
                <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
                  <h2 id={`${s.id}-h`}>
                    <span aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </h2>
                  {s.body}
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
