"use client";
import { useDisplayRefresh } from "@/components/useDisplayRefresh";
export default function ChangesLiveRefresh({ sheetDate, version, view, selectedType, showCleared }: { sheetDate: string; version: string | null; view: string; selectedType: string; showCleared: boolean }) {
  const filters = new URLSearchParams({ view, type: selectedType, showCleared: showCleared ? "1" : "0" }).toString();
  useDisplayRefresh("changes", sheetDate, version, 120000, filters);
  return null;
}
