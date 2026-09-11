import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TemplateCardPreview } from "./TemplateCardPreview";

afterEach(cleanup);

describe("TemplateCardPreview", () => {
  it("renders static thumbnail without live preview", () => {
    render(
      <div style={{ width: 320, height: 200 }}>
        <TemplateCardPreview
          templateId="tpl-1"
          surfaceKind="dashboard"
          thumbnailSrc="/template-assets/packs/de-dashboard-v1/thumbs/gov-efficiency.svg"
          eager
          className="h-full"
        />
      </div>,
    );

    const root = screen.getByTestId("template-card-preview");
    expect(root).toHaveAttribute("data-live", "false");
    const img = root.querySelector("img");
    expect(img).toHaveAttribute(
      "src",
      "/template-assets/packs/de-dashboard-v1/thumbs/gov-efficiency.svg",
    );
    expect(screen.queryByTestId("template-layout-live-preview")).not.toBeInTheDocument();
  });

  it("shows placeholder icon when thumbnail is missing", () => {
    render(
      <div style={{ width: 320, height: 200 }}>
        <TemplateCardPreview templateId="tpl-2" surfaceKind="data-screen" className="h-full" />
      </div>,
    );

    expect(screen.getByTestId("template-card-preview")).toHaveAttribute("data-live", "false");
    expect(screen.getByTestId("template-card-preview").querySelector("img")).toBeNull();
  });
});
