"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OperationsRefresh() {
  const router = useRouter();

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
