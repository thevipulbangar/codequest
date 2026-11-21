import { Suspense } from "react";
import { ProofView } from "./ProofView";

export const metadata = { title: "Proof of Downlink · OrbitPass", description: "Independently re-verified delivery record for one satellite pass." };
export default function Page() { return <Suspense><ProofView /></Suspense>; }
