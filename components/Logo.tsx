/**
 * OrbitPass emblem: a planet, one inclined orbit, and a contact between a ground point and a satellite.
 * Same drawing as the particle emblem on the home page. Decorative: the "OrbitPass" text next to it is the label.
 * Colours follow the surface it sits on (see --em-* in globals.css).
 */
const FRONT = "M-.914 .407L-.888 .444L-.847 .473L-.791 .495L-.722 .508L-.641 .512L-.548 .507L-.446 .494L-.337 .472L-.222 .443L-.103 .405L.018 .361L.138 .311L.256 .255L.37 .195L.477 .131L.577 .066L.666 -.001L.744 -.068L.809 -.134L.86 -.197L.897 -.257L.918 -.312L.924 -.363L.914 -.407";
const BACK = "M.914 -.407L.888 -.444L.847 -.473L.791 -.495L.722 -.508L.641 -.512L.548 -.507L.446 -.494L.393 -.484M-.623 -.032L-.706 .035L-.778 .101L-.836 .166L-.88 .227L-.91 .285L-.923 .338L-.921 .386L-.914 .407";

export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg className={`shrink-0 ${className}`} width={size * 1.22} height={size} viewBox="-1.12 -0.92 2.24 1.84" fill="none" aria-hidden="true">
      <path d={BACK} stroke="var(--em-orbit)" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle r=".62" fill="var(--em-fill)" stroke="var(--em-limb)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
      <path d={FRONT} stroke="var(--em-orbit)" strokeWidth="1.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d="M.26 .17L.828 -.155" stroke="var(--em-signal)" strokeWidth="1.2" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <circle cx=".26" cy=".17" r=".04" fill="var(--em-signal)" />
      <circle cx=".828" cy="-.155" r=".07" fill="var(--em-signal)" />
    </svg>
  );
}
