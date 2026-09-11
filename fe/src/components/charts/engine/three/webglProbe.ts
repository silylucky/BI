export type WebGLApi = "webgl2" | "webgl";

export type WebGLProbeResult = {
  ok: boolean;
  api?: WebGLApi;
  reason?: string;
};

const PROBE_CONTEXT_ATTRS: WebGLContextAttributes = {
  alpha: true,
  antialias: true,
  failIfMajorPerformanceCaveat: false,
};

function tryContext(
  canvas: HTMLCanvasElement,
  api: WebGLApi,
): WebGLRenderingContext | WebGL2RenderingContext | null {
  try {
    if (api === "webgl2") {
      return canvas.getContext("webgl2", PROBE_CONTEXT_ATTRS) as WebGL2RenderingContext | null;
    }
    return (
      canvas.getContext("webgl", PROBE_CONTEXT_ATTRS) ??
      canvas.getContext("experimental-webgl", PROBE_CONTEXT_ATTRS)
    ) as WebGLRenderingContext | null;
  } catch {
    return null;
  }
}

/** 探测 WebGL 是否可用（与 Three.js WebGLRenderer 参数对齐） */
export function probeWebGL(): WebGLProbeResult {
  if (typeof document === "undefined") {
    return { ok: false, reason: "no-document" };
  }

  try {
    const canvas = document.createElement("canvas");
    const webgl2 = tryContext(canvas, "webgl2");
    if (webgl2) {
      const result: WebGLProbeResult = { ok: true, api: "webgl2" };
      if (import.meta.env.DEV) {
        console.debug("[map-3d] webgl probe", result);
      }
      return result;
    }

    const webgl = tryContext(canvas, "webgl");
    if (webgl) {
      const result: WebGLProbeResult = { ok: true, api: "webgl" };
      if (import.meta.env.DEV) {
        console.debug("[map-3d] webgl probe", result);
      }
      return result;
    }

    const result: WebGLProbeResult = { ok: false, reason: "context-null" };
    if (import.meta.env.DEV) {
      console.debug("[map-3d] webgl probe", result);
    }
    return result;
  } catch (err) {
    const result: WebGLProbeResult = {
      ok: false,
      reason: err instanceof Error ? err.message : "probe-threw",
    };
    if (import.meta.env.DEV) {
      console.debug("[map-3d] webgl probe", result);
    }
    return result;
  }
}

export function webglAvailable(): boolean {
  return probeWebGL().ok;
}
