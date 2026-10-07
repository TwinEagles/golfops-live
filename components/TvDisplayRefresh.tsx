"use client";
import { useDisplayRefresh } from "@/components/useDisplayRefresh";
export default function TvDisplayRefresh({ selectedDate, version }: { selectedDate: string; version: string | null }) {
  useDisplayRefresh("tv", selectedDate, version, 60000);
  return null;
}
