// UI-facing re-exports. Keeps component imports narrow (always
// `@/components/compare-view-model`) while the underlying pure logic lives in
// `lib/analysis/**`.
export * from "@/lib/analysis/compare";
export * from "@/lib/analysis/compare-client";
export * from "@/lib/analysis/compare-diagnostics";
