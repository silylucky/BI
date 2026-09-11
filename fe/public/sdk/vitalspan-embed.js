(function (global) {
  function resolveContainer(container) {
    if (typeof container === "string") return document.querySelector(container);
    return container;
  }
  async function fetchSdkParams(apiBase, token) {
    const url = apiBase.replace(/\/$/, "") + "/embed/sdk-params?token=" + encodeURIComponent(token);
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) throw new Error("sdk-params failed");
    return resp.json();
  }
  function buildSrc(targetId, token, theme) {
    var origin = window.location.origin;
    var qs = "?token=" + encodeURIComponent(token);
    if (theme) qs += "&theme=" + encodeURIComponent(theme);
    return origin + "/embed/chart/" + encodeURIComponent(targetId) + qs;
  }
  async function init(options) {
    var host = resolveContainer(options.container);
    if (!host) {
      options.onError && options.onError("容器未找到");
      throw new Error("container not found");
    }
    var apiBase = options.apiBase || "/api/v1";
    await fetchSdkParams(apiBase, options.token);
    var iframe = document.createElement("iframe");
    iframe.src = buildSrc(options.targetId, options.token, options.theme);
    iframe.className = "w-full border-0";
    iframe.style.height = (options.height || 480) + "px";
    iframe.title = "VitalSpan 嵌入图表";
    iframe.addEventListener(
      "load",
      function () {
        options.onReady && options.onReady();
      },
      { once: true },
    );
    host.innerHTML = "";
    host.appendChild(iframe);
    return { iframe: iframe, container: host };
  }
  function destroy(handle) {
    if (!handle) return;
    handle.iframe && handle.iframe.remove();
    if (handle.container) handle.container.innerHTML = "";
  }
  function resize(handle, width, height) {
    if (!handle || !handle.iframe) return;
    handle.iframe.style.width = width + "px";
    handle.iframe.style.height = height + "px";
  }
  global.VitalSpanEmbed = { init: init, destroy: destroy, resize: resize };
})(typeof window !== "undefined" ? window : globalThis);
