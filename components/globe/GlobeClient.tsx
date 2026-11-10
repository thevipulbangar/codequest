"use client";
import dynamic from "next/dynamic";

export const GlobeClient = dynamic(() => import("./Globe"), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full rounded-full opacity-30" />,
});
