type DeliveryStep = {
  channel?: string;
  status?: string;
  error?: string;
  recipients?: string[];
};

export function formatDeliveryStepLines(
  steps?: DeliveryStep[],
): { title: string; detail: string }[] {
  if (!steps?.length) return [];
  return steps.map((step) => {
    const channel = step.channel ?? "unknown";
    const status = step.status ?? "unknown";
    if (channel === "email") {
      const emails = step.recipients?.join("、") ?? "—";
      return {
        title: "邮件",
        detail: status === "delivered" ? `已发送至 ${emails}` : step.error ?? `状态：${status}`,
      };
    }
    return {
      title: channel,
      detail: step.error ?? `状态：${status}`,
    };
  });
}

export function rowHasDeliveryDetail(steps?: DeliveryStep[]): boolean {
  return Boolean(steps?.length);
}
