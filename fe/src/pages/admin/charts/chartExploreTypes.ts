export type ChartTypeCatalogEntry = {
  type: string;
  displayName: string;
  category: string;
  paletteCategory?: string;
  renderer: string;
  library?: string;
  styleVariants: string[];
  capabilities: string[];
  deprecated?: boolean;
  migratesTo?: string | null;
  catalogRenderer?: string;
  catalogLibrary?: string;
  fieldRule: {
    minDimensions: number;
    maxDimensions: number;
    minMetrics: number;
    maxMetrics: number;
    note?: string | null;
  };
};
