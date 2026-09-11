export const CUSTOM_VIZ_PAYLOAD_CLASS = "vs-cv-payload";
export const CUSTOM_VIZ_PAYLOAD_UPDATE_EVENT = "vs-cv-payload-update";
export const CUSTOM_VIZ_LAYOUT_UPDATE_EVENT = "vs-cv-layout-update";
export const CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION = 1 as const;

export type CustomVizBindingStatus = "unbound" | "bound" | "empty" | "error";

export type CustomVizRuntimeLayout = {
  width: number;
  height: number;
};

export type CustomVizAxisPlan = {
  categoryCount?: number;
  categoryTickIndices?: number[];
};

/** 平台注入：与编辑器绑定的维/指标字段名，供 bundle 按名映射 columns。 */
export type CustomVizRuntimeEncoding = {
  dimensions: string[];
  metrics: string[];
};

export type CustomVizRuntimePayload = {
  protocolVersion: typeof CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION;
  bindingStatus: CustomVizBindingStatus;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  style: Record<string, unknown>;
  /** 与 binding.dimensions / binding.metrics 对齐的字段名（bound 时注入） */
  encoding?: CustomVizRuntimeEncoding;
  layout?: CustomVizRuntimeLayout;
  axisPlan?: CustomVizAxisPlan;
  truncated?: boolean;
  rowCap?: number;
  error?: string;
};

export function resolveCustomVizBindingStatus(args: {
  executeReady: boolean;
  loading: boolean;
  error: string | null;
  rows: (string | number | boolean | null)[][];
  slotBindingHint?: string | null;
}): CustomVizBindingStatus {
  if (!args.executeReady) {
    if (args.slotBindingHint) return "error";
    return "unbound";
  }
  if (args.error) return "error";
  if (args.loading && args.rows.length === 0) return "unbound";
  if (args.rows.length === 0) return "empty";
  return "bound";
}

import { buildCustomVizAxisPlan } from "./customVizLayoutHelpers";
import {
  applyCustomVizStyleBridgeAttributes,
  applyCustomVizStyleBridgeDom,
} from "./customVizStyleBridge";

export function buildCustomVizRuntimePayload(args: {
  executeReady: boolean;
  loading: boolean;
  error: string | null;
  columns: string[];
  rows: (string | number | boolean | null)[][];
  style: Record<string, unknown>;
  encoding?: CustomVizRuntimeEncoding;
  layout?: CustomVizRuntimeLayout;
  truncated?: boolean;
  rowCap?: number;
  slotBindingHint?: string | null;
}): CustomVizRuntimePayload {
  const bindingStatus = resolveCustomVizBindingStatus({
    executeReady: args.executeReady,
    loading: args.loading,
    error: args.error,
    rows: args.rows,
    slotBindingHint: args.slotBindingHint,
  });
  const payload: CustomVizRuntimePayload = {
    protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
    bindingStatus,
    columns: args.columns,
    rows: args.rows,
    style: args.style,
  };
  if (args.encoding && (args.encoding.dimensions.length > 0 || args.encoding.metrics.length > 0)) {
    payload.encoding = args.encoding;
  }
  if (args.layout) {
    payload.layout = args.layout;
    if (bindingStatus === "bound" && args.rows.length > 0) {
      const axisPlan = buildCustomVizAxisPlan(args.rows.length, args.layout.width);
      if (axisPlan) payload.axisPlan = axisPlan;
    }
  }
  if (args.truncated) {
    payload.truncated = true;
    if (args.rowCap != null) payload.rowCap = args.rowCap;
  }
  if (bindingStatus === "error" && args.error) {
    payload.error = args.error;
  } else if (bindingStatus === "error" && args.slotBindingHint) {
    payload.error = args.slotBindingHint;
  }
  return payload;
}

function styleToCssVars(style: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined) continue;
    const kebab = key.replace(/([A-Z])/g, "-$1").toLowerCase();
    out[`--vs-style-${kebab}`] = String(value);
  }
  return out;
}

function payloadSignature(payload: CustomVizRuntimePayload): string {
  return JSON.stringify(payload);
}

export function injectCustomVizPayload(host: HTMLElement, payload: CustomVizRuntimePayload): void {
  const signature = payloadSignature(payload);
  const styleSig = JSON.stringify(payload.style ?? {});
  const nextLayoutSig = payload.layout
    ? `${payload.layout.width}x${payload.layout.height}`
    : "";
  const prevPayloadSig = host.dataset.vsCvPayloadSig ?? "";
  const prevStyleSig = host.dataset.vsCvStyleSig ?? "";
  const prevLayoutSig = host.dataset.vsCvLayoutSig ?? "";

  const payloadChanged = prevPayloadSig !== signature;
  const styleChanged = prevStyleSig !== styleSig;
  const layoutChanged = Boolean(payload.layout) && nextLayoutSig !== prevLayoutSig;

  if (!payloadChanged && !styleChanged && !layoutChanged) return;

  if (payloadChanged || styleChanged) {
    let node = host.querySelector(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`);
    if (!node) {
      node = document.createElement("script");
      node.type = "application/json";
      node.className = CUSTOM_VIZ_PAYLOAD_CLASS;
      host.prepend(node);
    }
    node.textContent = JSON.stringify(payload);
    host.dataset.vsCvPayloadSig = signature;
  }

  if (styleChanged || payloadChanged) {
    const vars = styleToCssVars(payload.style ?? {});
    for (const [name, value] of Object.entries(vars)) {
      host.style.setProperty(name, value);
    }
    applyCustomVizStyleBridgeAttributes(host, payload.style);
    host.dataset.vsCvStyleSig = styleSig;
  }

  if (payloadChanged || styleChanged) {
    host.dispatchEvent(
      new CustomEvent(CUSTOM_VIZ_PAYLOAD_UPDATE_EVENT, {
        detail: payload,
        bubbles: false,
      }),
    );
    applyCustomVizStyleBridgeDom(host, payload.style);
  }

  if (layoutChanged && payload.layout) {
    host.dataset.vsCvLayoutSig = nextLayoutSig;
    host.dispatchEvent(
      new CustomEvent(CUSTOM_VIZ_LAYOUT_UPDATE_EVENT, {
        detail: payload.layout,
        bubbles: false,
      }),
    );
  }
}
