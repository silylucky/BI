export type TemplateReadiness = "live" | "demo";

const READINESS_LABELS: Record<TemplateReadiness, string> = {
  live: "已接数据源",
  demo: "示例态",
};

export function localizeTemplateReadiness(readiness: TemplateReadiness | string): string {
  return READINESS_LABELS[readiness as TemplateReadiness] ?? readiness;
}

export function isLiveTemplateReadiness(readiness: TemplateReadiness | string | undefined): boolean {
  return readiness === "live";
}
