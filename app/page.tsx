import { HomeAdapter } from "@/components/HomeAdapter";

/**
 * Landing page. The presentation lives in components/orbitpass/OrbitPassFrontend.tsx (portable, no backend);
 * components/HomeAdapter.tsx connects it to this app's session, router and public API routes.
 */
export default function Home() {
  return <HomeAdapter />;
}
