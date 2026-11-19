import type { Metadata } from "next";
import LegalPage, { OwnerReview, type LegalSection } from "@/components/LegalPage";
import ContactBlock from "@/components/ContactBlock";
import { mailtoHref, site, telHref } from "@/data/site";
import { formatTime } from "@/lib/format";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms that apply to using the Aurelia website and requesting a table reservation.",
  alternates: { canonical: "/terms-and-conditions" },
  openGraph: { title: "Terms & Conditions — Aurelia", url: "/terms-and-conditions" },
};

const { legal, reservations } = site;

const sections: LegalSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    body: (
      <p>
        These Terms &amp; Conditions govern your use of the Aurelia website and any reservation request you make through
        it. Aurelia is a café located in {site.location.display}. By using this website, you agree to these terms.
      </p>
    ),
  },
  {
    id: "website-usage",
    title: "Website usage",
    body: (
      <>
        <p>You may use this website to learn about Aurelia, view our menu and send reservation requests. You agree not to:</p>
        <ul>
          <li>Submit false, misleading or duplicate reservation requests</li>
          <li>Use the reservation form to send spam or unrelated messages</li>
          <li>Attempt to disrupt, overload or gain unauthorised access to the website</li>
        </ul>
      </>
    ),
  },
  {
    id: "menu-and-pricing",
    title: "Menu and pricing",
    body: (
      <>
        <p>
          Menu items and prices on this website are shown in Indian Rupees (₹) and are provided for information.
          Availability may vary, and prices may change without notice. The price charged at the café at the time of your
          visit applies.
        </p>
        <p>
          Items listed as “Market price” vary and will be confirmed by our team when you order. Food and drink photography
          on this website is illustrative and may not represent items currently available.
        </p>
        <p>
          {legal.pricesIncludeTax === null ? (
            <OwnerReview>Confirm whether menu prices include applicable taxes and state it here.</OwnerReview>
          ) : legal.pricesIncludeTax ? (
            "Menu prices include applicable taxes."
          ) : (
            "Applicable taxes are charged in addition to the menu prices."
          )}
        </p>
      </>
    ),
  },
  {
    id: "reservations",
    title: "Reservations",
    body: (
      <p>
        Aurelia is open {site.hours.display}, and tables can be requested for times up to {formatTime(site.hours.lastReservation)}.
        You can request a table for up to {reservations.maxGuests} guests through our website. For larger groups, please
        call us on <a href={telHref}>{site.contact.phoneDisplay}</a>. Please provide accurate contact details so we can
        reach you about your request.
      </p>
    ),
  },
  {
    id: "requests-and-confirmation",
    title: "Reservation requests and confirmation",
    body: (
      <>
        <p>
          Submitting the reservation form sends a <em>request</em> to Aurelia. It is not a confirmed booking.
        </p>
        <p>
          After you submit a request, you will receive an email acknowledging that we have received it. Your table is
          confirmed only when a member of our team contacts you to confirm availability. If we are unable to accommodate
          your request, we will let you know.
        </p>
      </>
    ),
  },
  {
    id: "cancellation-and-changes",
    title: "Cancellation and changes",
    body: (
      <>
        <p>
          If your plans change, please let us know as early as possible by email at{" "}
          <a href={mailtoHref}>{site.contact.email}</a> or by phone on <a href={telHref}>{site.contact.phoneDisplay}</a>.
        </p>
        {legal.cancellationPolicy || legal.lateArrivalPolicy ? (
          <ul>
            {legal.cancellationPolicy && (
              <li>
                <strong>Cancellations and changes:</strong> {legal.cancellationPolicy}
              </li>
            )}
            {legal.lateArrivalPolicy && (
              <li>
                <strong>Late arrival:</strong> {legal.lateArrivalPolicy}
              </li>
            )}
          </ul>
        ) : (
          <span className="slot">
            <OwnerReview>
              Cancellation and late-arrival policy — to be decided by Aurelia. No fees apply unless stated here.
            </OwnerReview>
          </span>
        )}
      </>
    ),
  },
  {
    id: "customer-responsibilities",
    title: "Customer responsibilities",
    body: (
      <ul>
        <li>Provide accurate and complete information when making a request</li>
        <li>Inform us of any changes to your plans or number of guests</li>
        <li>Let our team know about any dietary needs or allergies before ordering</li>
        <li>Treat our team, guests and premises with respect</li>
      </ul>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    body: (
      <p>
        The Aurelia name, website design and written content belong to Aurelia and may not be copied or reused without
        our permission. Photography on this website is used under the Unsplash licence and remains the property of its
        respective creators.
      </p>
    ),
  },
  {
    id: "third-party-links",
    title: "Third-party links",
    body: (
      <p>
        This website may link to or embed third-party services, such as Google Maps. We are not responsible for the
        content, availability or privacy practices of those services, and your use of them is governed by their own terms.
      </p>
    ),
  },
  {
    id: "limitation-of-liability",
    title: "Limitation of liability",
    body: (
      <p>
        We work to keep the information on this website accurate and up to date, but we do not guarantee that it is
        complete or error-free, or that the website will always be available. To the extent permitted by applicable law,
        Aurelia is not liable for any loss arising from your use of the website or from a reservation request that could
        not be accommodated.
      </p>
    ),
  },
  {
    id: "changes-to-terms",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms from time to time. The “Last updated” date at the top of this page shows when they were
        last revised. Continuing to use the website after changes means you accept the updated terms.
      </p>
    ),
  },
  {
    id: "contact-information",
    title: "Contact information",
    body: (
      <>
        <p>If you have questions about these terms, please contact us:</p>
        <ContactBlock />
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      sections={sections}
      notice={
        <>
          Draft for owner review. Please review the full text before publishing. Anything still undecided is marked{" "}
          <span className="owner">Owner review</span> and can be completed in <code>data/site.ts</code>.
        </>
      }
    />
  );
}
