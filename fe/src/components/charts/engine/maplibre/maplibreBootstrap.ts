import { addProtocol, Map, setWorkerUrl } from "maplibre-gl";
import maplibreWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { PMTiles, Protocol } from "pmtiles";

let bootstrapPromise: Promise<{ Map: typeof Map; protocol: Protocol }> | null = null;
let protocolSingleton: Protocol | null = null;

async function bootstrapMapLibre(): Promise<{ Map: typeof Map; protocol: Protocol }> {
  setWorkerUrl(maplibreWorker);
  protocolSingleton = new Protocol();
  addProtocol("pmtiles", protocolSingleton.tile);
  return { Map, protocol: protocolSingleton };
}

/** 懒加载 MapLibre + 全局 PMTiles 协议（Vite 须显式 setWorkerUrl）。 */
export async function loadMapLibreRuntime(): Promise<{ Map: typeof Map; protocol: Protocol }> {
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrapMapLibre();
  }
  return bootstrapPromise;
}

/** 与 MapLibre 官方 PMTiles 示例一致：预注册 archive，供 renderer 复用同一实例。 */
export async function ensurePmtilesArchiveRegistered(pmtilesUrl: string): Promise<void> {
  const { protocol } = await loadMapLibreRuntime();
  if (protocol.get(pmtilesUrl)) return;
  protocol.add(new PMTiles(pmtilesUrl));
}

export function resetMapLibreBootstrapForTests(): void {
  bootstrapPromise = null;
  protocolSingleton = null;
}
