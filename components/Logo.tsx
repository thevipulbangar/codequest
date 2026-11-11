import Image from "next/image";

/** OrbitPass emblem (satellite, ground-station dish and Earth). Decorative: the "OrbitPass" text next to it is the label. */
export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image src="/logo.png" alt="" width={size} height={size} priority
      className={`shrink-0 rounded-lg ring-1 ring-white/10 ${className}`} style={{ width: size, height: size }} />
  );
}
