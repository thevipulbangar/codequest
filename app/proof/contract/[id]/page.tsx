import { Suspense } from "react";
import { CertificateView } from "./CertificateView";

export const metadata = { title: "Delivery certificate · OrbitPass", description: "Guaranteed-downlink contract: target, verified volume and every pass used." };
export default function Page() { return <Suspense><CertificateView /></Suspense>; }
