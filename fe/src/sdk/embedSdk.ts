export type EmbedSdkInitOptions = {
  container: string | HTMLElement;
  token: string;
  apiBase?: string;
  targetType: "chart" | "dashboard";
  targetId: string;
  theme?: "light" | "dark";
  allowedOrigins?: string[];
  onReady?: () => void;
  onError?: (message: string) => void;
};

export type EmbedSdkHandle = {
  iframe: HTMLIFrameElement;
  container: HTMLElement;
  destroy: () => void;
};

type SdkParams = {
  containerId: string;
  theme?: string;
  apiBase?: string;
  token: string;
  shareMode?: "public" | "embed";
  targetType?: "chart" | "dashboard";
  targetId?: string;
};

function resolveContainer(container: string | HTMLElement): HTMLElement | null {
  if (typeof container === "string") {
    return document.querySelector<HTMLElement>(container);
  }
  return container;
}

async function fetchSdkParams(apiBase: string, token: string): Promise<SdkParams> {
  const url = `${apiBase.replace(/\/$/, "")}/embed/sdk-params?token=${encodeURIComponent(token)}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error("获取嵌入参数失败");
  }
  return resp.json() as Promise<SdkParams>;
}

function buildEmbedSrc(
  targetType: string,
  targetId: string,
  token: string,
  theme?: string,
  shareMode?: "public" | "embed",
): string {
  const origin = window.location.origin;
  const themeQs = theme ? `&theme=${encodeURIComponent(theme)}` : "";
  const shareQs = shareMode === "public" ? "&shareMode=public" : "";
  const path =
    targetType === "dashboard"
      ? `/embed/screen/${encodeURIComponent(targetId)}`
      : `/embed/chart/${encodeURIComponent(targetId)}`;
  return `${origin}${path}?token=${encodeURIComponent(token)}${shareQs}${themeQs}`;
}

export async function init(options: EmbedSdkInitOptions): Promise<EmbedSdkHandle> {
  const host = resolveContainer(options.container);
  if (!host) {
    options.onError?.("容器未找到");
    throw new Error("容器未找到");
  }
  const apiBase = options.apiBase ?? "/api/v1";
  let sdkParams: SdkParams;
  try {
    sdkParams = await fetchSdkParams(apiBase, options.token);
  } catch {
    options.onError?.("获取嵌入参数失败");
    throw new Error("获取嵌入参数失败");
  }
  const targetType = sdkParams.targetType ?? options.targetType;
  const targetId = sdkParams.targetId ?? options.targetId;
  const iframe = document.createElement("iframe");
  iframe.src = buildEmbedSrc(
    targetType,
    targetId,
    options.token,
    options.theme ?? sdkParams.theme,
    sdkParams.shareMode,
  );
  iframe.className = "w-full border-0";
  iframe.style.height = "480px";
  iframe.title = targetType === "dashboard" ? "VitalSpan 嵌入大屏" : "VitalSpan 嵌入图表";
  iframe.addEventListener("load", () => options.onReady?.(), { once: true });
  host.innerHTML = "";
  host.appendChild(iframe);
  const handle: EmbedSdkHandle = {
    iframe,
    container: host,
    destroy: () => destroy(handle),
  };
  return handle;
}

export function destroy(handle: EmbedSdkHandle): void {
  handle.iframe.remove();
  handle.container.innerHTML = "";
}

export function resize(handle: EmbedSdkHandle, width: number, height: number): void {
  handle.iframe.style.width = `${width}px`;
  handle.iframe.style.height = `${height}px`;
}
