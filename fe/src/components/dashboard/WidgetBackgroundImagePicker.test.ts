import { describe, expect, it } from "vitest";
import { patchWidgetBackgroundImageSelection } from "./WidgetBackgroundImagePicker";

describe("patchWidgetBackgroundImageSelection", () => {
  it("includes backgroundImage key when clearing so parent can detect removal", () => {
    const patch = patchWidgetBackgroundImageSelection(
      {
        backgroundImage: "/template-assets/packs/gov-enterprise-v1/backgrounds/dark/canvas-dark-cyan-radial-pulse.svg",
        backgroundImageFit: "cover",
      },
      undefined,
    );

    expect("backgroundImage" in patch).toBe(true);
    expect(patch.backgroundImage).toBeUndefined();
    expect(patch.backgroundImageFit).toBeUndefined();
    expect(patch.backgroundImagePosition).toBeUndefined();
  });
});
