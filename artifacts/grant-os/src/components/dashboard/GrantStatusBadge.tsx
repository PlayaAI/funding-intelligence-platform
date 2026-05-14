import { cn } from "@/lib/utils";
import type { GrantStatus } from "@/data/grants";
import { grantStatusColors } from "@/data/grants";

interface GrantStatusBadgeProps {
  status: GrantStatus;
  className?: string;
}

export default function GrantStatusBadge({ status, className }: GrantStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
        grantStatusColors[status],
        className
      )}
    >
      {status}
    </span>
  );
}
