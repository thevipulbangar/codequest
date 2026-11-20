/** Re-mounts on every navigation: a short fade so pages change like a cut, not a flash. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-fade flex min-h-full flex-1 flex-col">{children}</div>;
}
