import { describe, expect, it } from "vitest";
import { customVizHostStyle, mountCustomVizHtml } from "./customVizHost";
import {
  CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
  injectCustomVizPayload,
} from "./custom-viz/customVizPayload";
import type { CustomVizHostElement } from "./custom-viz/customVizRuntime";

describe("mountCustomVizHtml", () => {
  it("runs bundle script and re-renders on vs-cv-payload-update", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);
    const html = `<!DOCTYPE html><html><body><div id="vs-cv-root"></div><script>(function(){
      var host=document.currentScript.parentElement;
      function render(p){p=p||host.vsCv.getPayload();var root=host.querySelector('#vs-cv-root');if(!root)return;root.textContent=(p&&p.bindingStatus)||'none'}
      render();
      host.vsCv.onPayload(render);
    })();</script></body></html>`;

    mountCustomVizHtml(host, html);

    expect(host.querySelector("#vs-cv-root")?.textContent).toBe("none");
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: [],
      rows: [],
      style: {},
    });
    expect(host.querySelector("#vs-cv-root")?.textContent).toBe("bound");
    host.remove();
  });

  it("exposes vsCv.d3 and onPayload per host instance", () => {
    const a = document.createElement("div");
    a.className = "vs-custom-viz-host";
    const b = document.createElement("div");
    b.className = "vs-custom-viz-host";
    document.body.append(a, b);
    const html = `<!DOCTYPE html><html><body><div id="mark"></div><script>(function(){
      var host=document.currentScript.parentElement;
      var mark=host.querySelector('#mark');
      host.vsCv.onPayload(function(p){mark.textContent=p.bindingStatus});
      mark.textContent=typeof host.vsCv.d3.select;
    })();</script></body></html>`;

    mountCustomVizHtml(a, html);
    mountCustomVizHtml(b, html);

    expect((a as CustomVizHostElement).vsCv?.d3.select).toBeTypeOf("function");
    expect((b as CustomVizHostElement).vsCv?.d3.select).toBeTypeOf("function");
    expect((a as CustomVizHostElement).vsCv?.helpers.thinCategoryTickIndices(10, 320, 56).length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
    expect(a.querySelector("#mark")?.textContent).toBe("function");

    injectCustomVizPayload(a, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["n"],
      rows: [["x"]],
      style: {},
    });
    expect(a.querySelector("#mark")?.textContent).toBe("bound");
    expect(b.querySelector("#mark")?.textContent).toBe("function");
    a.remove();
    b.remove();
  });

  it("fires vsCv.mount when payload or layout changes", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);
    const html = `<!DOCTYPE html><html><body><div id="mark"></div><script>(function(){
      var host=document.currentScript.parentElement;
      var mark=host.querySelector('#mark');
      host.vsCv.mount(function(p){mark.textContent=(p.layout&&p.layout.width)||'none'});
    })();</script></body></html>`;
    mountCustomVizHtml(host, html);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: [],
      rows: [],
      style: {},
      layout: { width: 320, height: 200 },
    });
    expect(host.querySelector("#mark")?.textContent).toBe("320");
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["a"],
      rows: [[1]],
      style: {},
      layout: { width: 640, height: 200 },
      axisPlan: { categoryCount: 1, categoryTickIndices: [0] },
    });
    expect(host.querySelector("#mark")?.textContent).toBe("640");
    host.remove();
  });

  it("fires vsCv.mount with unbound payload when data is not ready", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);
    const html = `<!DOCTYPE html><html><body><div id="mark"></div><script>(function(){
      var host=document.currentScript.parentElement;
      var mark=host.querySelector('#mark');
      host.vsCv.mount(function(p){mark.textContent=p.bindingStatus});
    })();</script></body></html>`;
    mountCustomVizHtml(host, html);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "unbound",
      columns: [],
      rows: [],
      style: {},
      layout: { width: 320, height: 200 },
    });
    expect(host.querySelector("#mark")?.textContent).toBe("unbound");
    host.remove();
  });

  it("fires vsCv.mount with empty and error bindingStatus", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);
    const html = `<!DOCTYPE html><html><body><div id="mark"></div><script>(function(){
      var host=document.currentScript.parentElement;
      var mark=host.querySelector('#mark');
      host.vsCv.mount(function(p){mark.textContent=p.bindingStatus+':'+(p.error||'none')});
    })();</script></body></html>`;
    mountCustomVizHtml(host, html);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "empty",
      columns: [],
      rows: [],
      style: {},
      layout: { width: 320, height: 200 },
    });
    expect(host.querySelector("#mark")?.textContent).toBe("empty:none");
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "error",
      columns: [],
      rows: [],
      style: {},
      error: "查询失败",
      layout: { width: 320, height: 200 },
    });
    expect(host.querySelector("#mark")?.textContent).toBe("error:查询失败");
    host.remove();
  });

  it("polyfills host.getElementById for bundle scripts using (host||document).getElementById", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);
    const html = `<!DOCTYPE html><html><body><div id="vs-cv-track"></div><script>(function(){
      var host=document.currentScript.parentElement;
      function q(id){return (host||document).getElementById(id)}
      host.vsCv.mount(function(p){
        var track=q('vs-cv-track');
        if(!track)return;
        track.textContent=(p.rows&&p.rows.length)?String(p.rows.length):'empty';
      });
    })();</script></body></html>`;
    mountCustomVizHtml(host, html);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["a"],
      rows: [[1], [2]],
      style: {},
    });
    expect(host.querySelector("#vs-cv-track")?.textContent).toBe("2");
    host.remove();
  });

  it("fires vsCv.onLayout when payload layout changes", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);
    const html = `<!DOCTYPE html><html><body><div id="mark"></div><script>(function(){
      var host=document.currentScript.parentElement;
      var mark=host.querySelector('#mark');
      host.vsCv.onLayout(function(layout){mark.textContent=layout.width+'x'+layout.height});
    })();</script></body></html>`;
    mountCustomVizHtml(host, html);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: [],
      rows: [],
      style: {},
      layout: { width: 320, height: 200 },
    });
    expect(host.querySelector("#mark")?.textContent).toBe("320x200");
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: [],
      rows: [],
      style: {},
      layout: { width: 640, height: 200 },
    });
    expect(host.querySelector("#mark")?.textContent).toBe("640x200");
    host.remove();
  });
});

describe("customVizHostStyle", () => {
  it("uses transparent background and dashboard font family", () => {
    const style = customVizHostStyle({
      colorScheme: "dark",
      fontFamily: "Georgia, serif",
      paletteColors: ["#112233", "#445566"],
    });

    expect(style.background).toBe("transparent");
    expect(style.fontFamily).toBe("Georgia, serif");
    expect((style as Record<string, string>)["--dashboard-font-family"]).toBe("Georgia, serif");
    expect((style as Record<string, string>)["--vs-palette-0"]).toBe("#112233");
    expect((style as Record<string, string>)["--vs-d3-accent"]).toBe("#112233");
  });

  it("inherits font when dashboard font is unset", () => {
    const style = customVizHostStyle({ colorScheme: "light" });
    expect(style.fontFamily).toBe("inherit");
    expect((style as Record<string, string>)["--dashboard-font-family"]).toBeUndefined();
  });
});
