import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div id="top">
      <Navbar variant="solid" />
      <main id="main" className="wrap" style={{ padding: "200px 0 160px", textAlign: "center" }}>
        <p className="eyebrow text-accent-ink">Page not found</p>
        <h1 className="h2" style={{ marginTop: 22 }}>This table seems to be empty.</h1>
        <p className="text-stone-ink" style={{ margin: "24px auto 40px", maxWidth: 420 }}>
          The page you’re looking for doesn’t exist or has moved.
        </p>
        <Link className="btn btn-dark" href="/">
          Back to home
        </Link>
      </main>
      <Footer />
    </div>
  );
}
