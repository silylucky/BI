import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

type ReportCenterBackLinkProps = {
  label?: string;
};

export function ReportCenterBackLink({ label = "返回报表中心" }: ReportCenterBackLinkProps) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-10" asChild>
      <Link to="/admin/reports/center">
        <ArrowLeft className="size-4" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
