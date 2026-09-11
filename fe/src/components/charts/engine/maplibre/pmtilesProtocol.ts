import {
  ensurePmtilesArchiveRegistered,
  loadMapLibreRuntime,
  resetMapLibreBootstrapForTests,
} from "@/components/charts/engine/maplibre/maplibreBootstrap";

/** @deprecated 使用 loadMapLibreRuntime / ensurePmtilesArchiveRegistered */
export async function registerPmtilesProtocol(
  maplibregl: typeof import("maplibre-gl"),
): Promise<void> {
  void maplibregl;
  await loadMapLibreRuntime();
}

export { ensurePmtilesArchiveRegistered, loadMapLibreRuntime, resetMapLibreBootstrapForTests };

export function resetPmtilesProtocolForTests(): void {
  resetMapLibreBootstrapForTests();
}
