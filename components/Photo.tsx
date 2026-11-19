import Image, { type StaticImageData } from "next/image";

interface PhotoProps {
  src: StaticImageData;
  alt: string;
  /** Responsive `sizes` hint so the browser downloads an appropriately sized file. */
  sizes: string;
  className?: string;
  objectPosition?: string;
}

/** A cropped, lazy-loaded photograph inside a fixed-aspect frame (aspect set by parent CSS). */
export default function Photo({ src, alt, sizes, className = "", objectPosition }: PhotoProps) {
  return (
    <figure className={`frame unveil ${className}`}>
      <Image src={src} alt={alt} fill sizes={sizes} placeholder="blur" style={objectPosition ? { objectPosition } : undefined} />
    </figure>
  );
}
