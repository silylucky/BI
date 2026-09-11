import { apiFetch } from "@/lib/api";

export type TileServiceResolve = {
  id: string;
  name: string;
  pmtilesUrl: string;
  glyphsUrl: string;
  spriteUrl: string;
};

type TileServiceResolveRaw = TileServiceResolve & {
  pmtiles_url?: string;
  glyphs_url?: string;
  sprite_url?: string;
};

function normalizeTileServiceResolve(raw: TileServiceResolveRaw): TileServiceResolve {
  const pmtilesUrl = raw.pmtilesUrl ?? raw.pmtiles_url;
  const glyphsUrl = raw.glyphsUrl ?? raw.glyphs_url;
  const spriteUrl = raw.spriteUrl ?? raw.sprite_url;
  if (!raw.id || !raw.name || !pmtilesUrl || !glyphsUrl || !spriteUrl) {
    throw new Error("tile service resolve response is incomplete");
  }
  return {
    id: raw.id,
    name: raw.name,
    pmtilesUrl,
    glyphsUrl,
    spriteUrl,
  };
}

export type TileServiceListItem = {
  id: string;
  name: string;
  enabled: boolean;
};

type TileServiceListResponse = {
  items: TileServiceListItem[];
};

export async function listTileServices(): Promise<TileServiceListItem[]> {
  const res = await apiFetch<TileServiceListResponse>("/api/v1/tile-services");
  return res.items ?? [];
}

export async function resolveTileService(serviceId: string): Promise<TileServiceResolve> {
  const raw = await apiFetch<TileServiceResolveRaw>(
    `/api/v1/tile-services/${encodeURIComponent(serviceId)}/resolve`,
  );
  return normalizeTileServiceResolve(raw);
}
