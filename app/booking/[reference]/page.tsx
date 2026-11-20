import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ManageBooking, { type ManageView } from "@/components/ManageBooking";
import { site, telHref } from "@/data/site";
import { REFERENCE_RE, verifyReference } from "@/lib/booking-token";
import { manageState } from "@/lib/manage";
import { getBooking } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage your booking",
  robots: { index: false, follow: false },
};

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-msg">
      <h2>{title}</h2>
      <p>{children}</p>
      <Link className="btn btn-ghost" href="/" style={{ marginTop: 32 }}>
        Back to the website
      </Link>
    </div>
  );
}

export default async function ManageBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const { reference: rawRef } = await params;
  const { t } = await searchParams;
  const reference = decodeURIComponent(rawRef).toUpperCase();
  const token = Array.isArray(t) ? t[0] : t;
  const call = (
    <>
      call us on <a href={telHref}>{site.contact.phoneDisplay}</a>
    </>
  );

  let content: React.ReactNode;
  if (!REFERENCE_RE.test(reference) || !verifyReference(reference, token)) {
    content = (
      <Message title="This link isn’t valid.">
        Please open the “Change or cancel booking” link from your latest Aurelia email, or {call}.
      </Message>
    );
  } else {
    const found = await getBooking(reference);
    if (found.status === "found") {
      const b = found.booking;
      const view: ManageView = {
        reference: b.reference,
        status: b.status,
        date: b.date,
        time: b.time,
        guests: b.guests,
        event: b.event,
        ...manageState(b),
      };
      content = <ManageBooking token={token!} initial={view} firstName={b.name.split(" ")[0]} />;
    } else if (found.status === "not-found") {
      content = <Message title="We couldn’t find this booking.">It may have been removed. Please {call}.</Message>;
    } else {
      content = (
        <Message title="Managing bookings online isn’t available right now.">Please try again in a little while, or {call}.</Message>
      );
    }
  }

  return (
    <div id="top">
      <Navbar variant="solid" />
      <main id="main" className="res mb-page">
        <div className="wrap">
          <p className="eyebrow">Your booking</p>
          <h1 className="h2" style={{ marginTop: 22 }}>
            Manage your booking.
          </h1>
          {content}
        </div>
      </main>
      <Footer />
    </div>
  );
}
