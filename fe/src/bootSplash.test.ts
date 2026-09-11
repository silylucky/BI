// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { dismissBootSplash, reportBootFailure } from "./bootSplash";

describe("bootSplash", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    delete window.__VS_BOOT__;
  });

  it("reportBootFailure updates status text before mount", () => {
    document.body.innerHTML = `
      <div id="vs-boot-splash" aria-busy="true">
        <span id="vs-boot-status-text">正在加载，请稍候…</span>
      </div>
    `;

    reportBootFailure("应用加载失败：模块不存在");

    expect(document.getElementById("vs-boot-status-text")?.textContent).toBe(
      "应用加载失败：模块不存在",
    );
    expect(document.getElementById("vs-boot-splash")?.getAttribute("aria-busy")).toBe("false");
  });

  it("dismissBootSplash removes splash and marks mounted", () => {
    document.body.innerHTML = `<div id="vs-boot-splash"></div>`;

    dismissBootSplash();

    expect(document.getElementById("vs-boot-splash")).toBeNull();
    expect(window.__VS_BOOT__?.mounted).toBe(true);
  });

  it("reportBootFailure is ignored after dismiss", () => {
    document.body.innerHTML = `
      <div id="vs-boot-splash" aria-busy="true">
        <span id="vs-boot-status-text">正在加载，请稍候…</span>
      </div>
    `;
    dismissBootSplash();
    document.body.innerHTML += `<span id="vs-boot-status-text">残留</span>`;

    reportBootFailure("不应写入");

    expect(document.getElementById("vs-boot-status-text")?.textContent).toBe("残留");
  });
});
