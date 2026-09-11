import catalog from "./borderlessDecorCatalog.generated.json";

export type BorderlessDecorAsset = {
  id: string;
  label: string;
  url: string;
  style: string;
  palette: string;
};

export const BORDERLESS_DECOR_PACK = "/template-assets/packs/borderless-decor-v1";

export const BORDERLESS_DECOR_ASSETS = catalog as BorderlessDecorAsset[];

export function groupBorderlessDecorByStyle(assets = BORDERLESS_DECOR_ASSETS) {
  const map = new Map<string, BorderlessDecorAsset[]>();
  for (const row of assets) {
    const list = map.get(row.style) ?? [];
    list.push(row);
    map.set(row.style, list);
  }
  return map;
}
