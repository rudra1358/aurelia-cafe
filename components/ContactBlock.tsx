import { mailtoHref, site, telHref } from "@/data/site";

export default function ContactBlock() {
  return (
    <p className="lg-sign">
      {site.name}
      <br />
      <a href={mailtoHref}>{site.contact.email}</a>
      <br />
      <a href={telHref}>{site.contact.phoneDisplay}</a>
      <br />
      {site.location.exactAddress ? (
        <>
          {site.location.exactAddress}
          <br />
        </>
      ) : null}
      {site.location.display}
    </p>
  );
}
