import { describe, expect, it, vi } from "vitest";
import {
  filterTemplateAssetsByScope,
  galleryPreviewUrl,
  isGalleryEligibleAsset,
  resolveTemplateAssetUrl,
  TEMPLATE_ASSET_CATALOG,
} from "./templateAssetCatalog";

vi.mock("./appBasePath", () => {
  const getAppBasePath = () => "/admin";
  return {
    getAppBasePath,
    resolvePublicAssetUrl: (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return "";
      if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return trimmed;
      const base = getAppBasePath();
      const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      if (base && (normalized === base || normalized.startsWith(`${base}/`))) {
        return normalized;
      }
      return `${base}${normalized}`;
    },
  };
});

describe("templateAssetCatalog", () => {
  it("loads generated catalog with urls", () => {
    expect(TEMPLATE_ASSET_CATALOG.length).toBeGreaterThan(100);
    expect(TEMPLATE_ASSET_CATALOG[0]?.url).toMatch(/^\/template-assets\//);
  });

  it("excludes thumb and deprecated dashboard categories from canvas gallery", () => {
    const canvas = filterTemplateAssetsByScope("canvas");
    expect(canvas.some((item) => item.category === "thumb")).toBe(false);
    expect(canvas.some((item) => item.category === "canvas-thumb")).toBe(false);
    expect(canvas.some((item) => item.category === "dashboard-template")).toBe(false);
    expect(canvas.some((item) => item.category === "dashboard-variant")).toBe(false);
    expect(canvas.some((item) => item.category === "canvas-dark")).toBe(true);
    expect(canvas.some((item) => item.category === "title-strip")).toBe(false);
  });

  it("includes top decoration assets in screen gallery scope", () => {
    const screen = filterTemplateAssetsByScope("screen");
    expect(screen.some((item) => item.category === "title-strip")).toBe(true);
    expect(screen.some((item) => item.category === "screen-header")).toBe(true);
    expect(screen.some((item) => item.category === "canvas-dark")).toBe(true);
    expect(screen.some((item) => item.category === "borderless-decor")).toBe(true);
    expect(screen.some((item) => item.category === "component-panel")).toBe(true);
    expect(screen.some((item) => item.category === "top-decor-clear")).toBe(false);
  });

  it("excludes transparent top decor from background gallery", () => {
    const background = filterTemplateAssetsByScope("background");
    expect(background.some((item) => item.category === "top-decor-clear")).toBe(false);
    expect(isGalleryEligibleAsset({ category: "top-decor-clear" } as never)).toBe(false);
  });

  it("uses the same categories for background and widget gallery scopes", () => {
    const background = filterTemplateAssetsByScope("background");
    const widget = filterTemplateAssetsByScope("widget");
    expect(background.map((item) => item.id).sort()).toEqual(widget.map((item) => item.id).sort());
    expect(background.some((item) => item.category === "component-panel")).toBe(true);
  });

  it("keeps canvas-thumb wireframe entries on thumb path", () => {
    const thumb = TEMPLATE_ASSET_CATALOG.find((item) => item.category === "canvas-thumb");
    expect(thumb).toBeDefined();
    expect(galleryPreviewUrl(thumb!)).toBe(resolveTemplateAssetUrl(thumb!.url));
    expect(galleryPreviewUrl(thumb!).includes("/thumbs/")).toBe(true);
  });

  it("uses dark composite thumb for transparent top decor in gallery", () => {
    const clear = TEMPLATE_ASSET_CATALOG.find((item) => item.id === "title-clear-diamond-flank-cyan");
    expect(clear).toBeDefined();
    expect(isGalleryEligibleAsset(clear!)).toBe(false);
  });

  it("marks excluded categories as ineligible", () => {
    const thumb = TEMPLATE_ASSET_CATALOG.find((item) => item.category === "thumb");
    expect(thumb).toBeDefined();
    expect(isGalleryEligibleAsset(thumb!)).toBe(false);
  });

  it("prefixes template asset urls with app base path for gallery rendering", () => {
    expect(resolveTemplateAssetUrl("/template-assets/backgrounds/screen-cyber-blue.svg")).toBe(
      "/admin/template-assets/backgrounds/screen-cyber-blue.svg",
    );
    expect(
      resolveTemplateAssetUrl("/admin/template-assets/backgrounds/screen-cyber-blue.svg"),
    ).toBe("/admin/template-assets/backgrounds/screen-cyber-blue.svg");
    expect(resolveTemplateAssetUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("serves screen-bg gallery thumbs from packs thumbs path", () => {
    const screenBg = TEMPLATE_ASSET_CATALOG.find((item) => item.id === "screen-cyber-blue");
    expect(screenBg).toBeDefined();
    expect(screenBg!.url).toContain("/packs/gov-enterprise-v1/backgrounds/legacy/");
    expect(screenBg!.thumbUrl).toContain("/packs/gov-enterprise-v1/thumbs/");
    expect(galleryPreviewUrl(screenBg!)).toContain("/admin/template-assets/packs/gov-enterprise-v1/thumbs/");
  });

  it("excludes grid-pattern canvas backgrounds from gallery", () => {
    const canvas = filterTemplateAssetsByScope("canvas");
    const gridLike = [
      "honeycomb",
      "hud-scan",
      "circuit",
      "aurora",
      "command",
      "radial-pulse",
      "hex-nodes",
      "dots",
      "stripes",
      "tech-rail",
    ] as const;
    for (const pattern of gridLike) {
      expect(canvas.some((item) => item.pattern === pattern)).toBe(false);
    }
    expect(canvas.some((item) => item.pattern === "gradient-mesh")).toBe(true);
    expect(canvas.some((item) => item.pattern === "topbar-icons")).toBe(true);
    expect(canvas.some((item) => item.pattern === "de-cloud-center")).toBe(true);
  });

  it("uses packs thumbs for canvas-light preview", () => {
    const light = TEMPLATE_ASSET_CATALOG.find((item) => item.id === "canvas-light-lime-gradient-mesh");
    expect(light).toBeDefined();
    expect(light!.thumbUrl).toContain("/packs/gov-enterprise-v1/thumbs/");
    expect(galleryPreviewUrl(light!)).toContain("/admin/template-assets/packs/gov-enterprise-v1/thumbs/");
    expect(galleryPreviewUrl(light!)).not.toContain("/backgrounds/light/");
  });
});
