import type { Metadata } from "next";
import LegalPage, { OwnerReview, type LegalSection } from "@/components/LegalPage";
import ContactBlock from "@/components/ContactBlock";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Aurelia collects, uses and protects the information you share through our website and reservation requests.",
  alternates: { canonical: "/privacy-policy" },
  openGraph: { title: "Privacy Policy — Aurelia", url: "/privacy-policy" },
};

const { legal } = site;

/** Name of the backup email provider, if one is configured (read at build time). */
const fallbackHost = process.env.FALLBACK_SMTP_HOST?.trim() ?? "";
/** WhatsApp updates are mentioned only when they're switched on (read at build time). */
const whatsappOn = process.env.NEXT_PUBLIC_WHATSAPP_OPT_IN?.trim() === "true" || !!process.env.WHATSAPP_TOKEN?.trim();
const fallbackProvider =fallbackHost ? (/brevo|sendinblue/i.test(fallbackHost) ? "Brevo" : "A backup email delivery provider") : null;

const sections: LegalSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    body: (
      <>
        <p>
          Aurelia (“Aurelia”, “we”, “us”) is a café in {site.location.display}. This Privacy Policy explains what
          information we collect through our website, how we use it, and the choices you have.
        </p>
        <p>By using our website or submitting a reservation request, you acknowledge the practices described here.</p>
      </>
    ),
  },
  {
    id: "information-we-collect",
    title: "Information we collect",
    body: (
      <>
        <p>
          We only collect the information you choose to give us through the reservation form. We do not ask you to create
          an account, and the website does not use advertising or analytics cookies.
        </p>
        <p>
          Like most websites, the service that hosts our site may automatically record basic technical information — such
          as your IP address, browser type and the pages requested — to deliver and protect the website. Our server also
          uses your IP address briefly, in memory, to limit repeated form submissions.
        </p>
      </>
    ),
  },
  {
    id: "personal-information",
    title: "Personal information",
    body: (
      <>
        <p>When you submit a reservation request, we collect:</p>
        <ul>
          <li>Your full name</li>
          <li>Your email address</li>
          <li>Your phone number</li>
        </ul>
        <p>Please do not include sensitive personal information in the special requests field beyond what is needed for your visit.</p>
      </>
    ),
  },
  {
    id: "reservation-information",
    title: "Reservation information",
    body: (
      <>
        <p>
          Along with your contact details, we collect the details of your requested visit: reservation date, preferred
          time, number of guests and any special requests you write (for example, a celebration or a seating preference).
        </p>
        <p>
          Submitting the form sends a reservation <em>request</em>. It does not create a confirmed booking until our team
          contacts you.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use-information",
    title: "How we use information",
    body: (
      <>
        <p>We use the information you provide only to:</p>
        <ul>
          <li>Receive and review your reservation request</li>
          <li>Contact you by email or phone to confirm availability, or to discuss changes</li>
          <li>Prepare for your visit, including any special requests</li>
          <li>Respond to questions you send us</li>
        </ul>
        <p>We do not sell your information, and we do not use it for marketing.</p>
      </>
    ),
  },
  {
    id: "email-communications",
    title: "Email communications",
    body: (
      <>
        <p>
          When you submit a reservation request, our website automatically sends an acknowledgement to the email address
          you provide, and may also send a notification containing your request details to the café’s inbox. Each request
          is given a short reference number that appears in these emails. Our team may
          then email or call you about your reservation.
        </p>
        <p>
          We also email you when your booking is confirmed, declined or cancelled (a confirmation includes a calendar file
          you can add to your calendar), and send a reminder the day before a confirmed booking. These emails contain a
          private link that lets you change or cancel your booking; anyone with that link can do so, so please don’t share it.
        </p>
        {whatsappOn && (
          <p>
            If you tick the WhatsApp box on the form, we also send these booking updates to your phone number on WhatsApp.
            You can ask us to stop at any time.
          </p>
        )}
        <p>We do not send newsletters or promotional emails. If that changes, we will ask for your consent first.</p>
      </>
    ),
  },
  {
    id: "data-storage-and-security",
    title: "Data storage and security",
    body: (
      <>
        <p>
          The website does not keep its own database of reservations. When you submit a request, our server sends it by
          email to the café and to you, and adds it as a row to a private Google Sheet that the café uses to manage
          reservations. Your request is then held in the café’s email account and in that sheet, which only the café can
          access.
        </p>
        <p>
          Our email account credentials are kept on the server and are never included in the website’s public code. We
          take reasonable steps to protect your information, but no method of transmission or storage over the internet is
          completely secure, and we cannot guarantee absolute security.
        </p>
      </>
    ),
  },
  {
    id: "third-party-services",
    title: "Third-party services",
    body: (
      <>
        <p>We rely on a small number of third-party services to run the website:</p>
        <ul>
          <li>
            <strong>Google (Gmail)</strong> — to send and receive reservation emails. Your request details pass through and
            are stored by Google’s email service.
          </li>
          <li>
            <strong>Google Sheets and Google Apps Script</strong> — to keep a record of reservation requests in a private
            spreadsheet owned by the café.
          </li>
          {fallbackProvider && (
            <li>
              <strong>{fallbackProvider}</strong> — a backup email service, used to send reservation emails only when our
              main email account can’t. Your request details pass through it when it’s used.
            </li>
          )}
          {whatsappOn && (
            <li>
              <strong>WhatsApp (Meta)</strong> — to send booking updates to guests who ask for them, and booking alerts to
              the café. Your name, phone number and booking details pass through it.
            </li>
          )}
          <li>
            <strong>Google Maps</strong> — to display a map of our area. When the map loads, Google may collect information
            such as your IP address under its own privacy policy.
          </li>
          <li>
            <strong>Website hosting</strong> —{" "}
            {legal.hostingProvider ? legal.hostingProvider : <OwnerReview>name the hosting provider once chosen.</OwnerReview>}
          </li>
        </ul>
        <p>These providers process information under their own privacy policies, which we encourage you to read.</p>
      </>
    ),
  },
  {
    id: "data-retention",
    title: "Data retention",
    body: (
      <p>
        We keep reservation emails and spreadsheet records only as long as reasonably needed to manage your reservation
        and any follow-up.{" "}
        {legal.retentionPeriod ? (
          <>Reservation records are deleted {legal.retentionPeriod}.</>
        ) : (
          <OwnerReview>Set a specific retention period and state it here.</OwnerReview>
        )}
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>You may ask us to:</p>
        <ul>
          <li>Tell you what information we hold about you</li>
          <li>Correct inaccurate information</li>
          <li>Delete your information, where we no longer need it</li>
          <li>Withdraw any consent you have given</li>
        </ul>
        <p>To make a request, email us using the details below. We will respond within a reasonable time.</p>
      </>
    ),
  },
  {
    id: "policy-changes",
    title: "Policy changes",
    body: (
      <p>
        We may update this Privacy Policy when our website or practices change. The “Last updated” date at the top of this
        page shows when it was last revised.
      </p>
    ),
  },
  {
    id: "contact-information",
    title: "Contact information",
    body: (
      <>
        <p>For any questions about this policy or your information, please contact us:</p>
        <ContactBlock />
      </>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      sections={sections}
      notice={
        <>
          Draft for owner review. This policy describes how the website works today. Please review it — ideally with a
          legal advisor — before publishing, and update it whenever the website’s data practices change. Items marked{" "}
          <span className="owner">Owner review</span> need a decision.
        </>
      }
    />
  );
}
