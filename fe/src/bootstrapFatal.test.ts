// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { showBootstrapFatal } from "./bootstrapFatal";

describe("showBootstrapFatal", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.classList.remove("dark");
    delete window.__VS_BOOT__;
  });

  it("renders safe text without interpreting HTML", () => {
    const root = document.createElement("div");
    document.body.append(root, `<div id="vs-boot-splash"></div>`);

    showBootstrapFatal(root, '<img src=x onerror="alert(1)">');

    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(root.querySelector("img")).toBeNull();
    expect(document.getElementById("vs-boot-splash")).toBeNull();
  });

  it("uses dark palette when html.dark is set", () => {
    document.documentElement.classList.add("dark");
    const root = document.createElement("div");
    document.body.append(root);

    showBootstrapFatal(root, "网络错误");

    const shell = root.querySelector('[role="alert"]') as HTMLElement | null;
    expect(shell?.style.background).toBe("rgb(16, 24, 40)");
  });
});
