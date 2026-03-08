import type { ButtonHTMLAttributes } from "react";
import { Download, FileText, Pencil } from "lucide-react";
import UtilityButton from "./UtilityButton";

type AssessmentActionKind = "edit" | "summary" | "download";

const ACTION_CONFIG: Record<AssessmentActionKind, { label: string; icon: typeof Pencil }> = {
  edit: {
    label: "Edit quiz",
    icon: Pencil,
  },
  summary: {
    label: "View summary",
    icon: FileText,
  },
  download: {
    label: "Download quiz",
    icon: Download,
  },
};

interface AssessmentActionIconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  action: AssessmentActionKind;
}

export default function AssessmentActionIconButton({
  action,
  className = "",
  title,
  "aria-label": ariaLabel,
  ...props
}: AssessmentActionIconButtonProps) {
  const { label, icon: Icon } = ACTION_CONFIG[action];

  return (
    <UtilityButton
      small
      title={title ?? label}
      aria-label={ariaLabel ?? title ?? label}
      className={`inline-flex! min-w-10 items-center justify-center px-2.5! py-2! ${className}`}
      {...props}
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </UtilityButton>
  );
}