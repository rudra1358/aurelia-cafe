"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu as MenuIcon, X } from "lucide-react";
import { mailtoHref, site, telHref } from "@/data/site";
import type { TranslationKey } from "@/data/translations";
import { LanguageSwitch, useT } from "./Language";

const links: { href: string; key: TranslationKey }[] = [
  { href: "/#home", key: "nav.home" },
  { href: "/#about", key: "nav.about" },
  { href: "/#menu", key: "nav.menu" },
  { href: "/events", key: "nav.events" },
  { href: "/#contact", key: "nav.contact" },
];

/**
 * `overlay` — transparent over the hero, turning solid on scroll (home page).
 * `solid`   — always solid (inner pages).
 */
export default function Navbar({ variant = "overlay" }: { variant?: "overlay" | "solid" }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    if (variant === "solid") return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [variant]);

  // Mobile menu: close on Escape, lock page scroll, close when resized to desktop.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth > 900 && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const solid = variant === "solid" || scrolled || open;
  const close = () => setOpen(false);

  return (
    <>
      <nav className={`nav ${solid ? "solid" : "clear"}`} aria-label="Primary">
        <div className="wrap nav-in">
          <Link className="logo" href="/" aria-label="Aurelia — home">
            {site.wordmark}
          </Link>
          <ul className="nav-links">
            {links.map((l) => (
              <li key={l.href}>
                <a className="nav-link" href={l.href}>
                  {t(l.key)}
                </a>
              </li>
            ))}
          </ul>
          <div className="nav-end">
            <LanguageSwitch className="nav-lang" />
            <Link className="btn nav-cta" href="/#reservation">
              {t("nav.reserve")}
            </Link>
            <button
              className="burger"
              type="button"
              aria-controls="mobile-menu"
              aria-expanded={open}
              aria-label={open ? t("nav.close") : t("nav.open")}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X size={24} strokeWidth={1.3} aria-hidden /> : <MenuIcon size={24} strokeWidth={1.3} aria-hidden />}
            </button>
          </div>
        </div>
      </nav>

      {open && (
        <div className="mpanel" id="mobile-menu">
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={close}>
                  {t(l.key)}
                  <ArrowRight size={22} strokeWidth={1.2} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
          <Link className="btn btn-dark" href="/#reservation" onClick={close}>
            {t("nav.reserve")}
          </Link>
          <LanguageSwitch className="mp-lang" />
          <div className="mp-meta">
            <a href={telHref}>{site.contact.phoneDisplay}</a>
            <a href={mailtoHref}>{site.contact.email}</a>
            <span>
              {site.location.area}, {site.location.city}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
