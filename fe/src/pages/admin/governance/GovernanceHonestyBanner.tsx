import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/** FAKE-06 / H1：治理深链诚实提示（侧栏固定隐藏，深链仍可访问） */
export function GovernanceHonestyBanner() {
  return (
    <Alert severity="warning" appearance="subtle" className="mb-4" data-testid="gov-honesty-banner">
      <AlertTitle>未对接真实总线 / 差异化能力</AlertTitle>
      <AlertDescription>
        治理侧栏固定隐藏。本页为深链入口，能力未对接真实总线，仅供工程探查。
      </AlertDescription>
    </Alert>
  );
}

export function withGovernanceHonesty(page: ReactNode) {
  return (
    <>
      <GovernanceHonestyBanner />
      {page}
    </>
  );
}
