import type { ReactNode } from "react";

const cx = (...classes: Array<string | false | undefined | null>) =>
  classes.filter(Boolean).join(" ");

type SkeletonLoaderProps = {
  /** Number of placeholder lines to display */
  lines?: number;
  /** Shows a circular avatar placeholder similar to social feeds */
  showAvatar?: boolean;
  /** Optional footer placeholder block */
  showFooter?: boolean;
  /** Additional content rendered under the skeleton (e.g., label) */
  children?: ReactNode;
  /** Additional classes for the outer wrapper */
  className?: string;
};

const SkeletonBar = ({ className = "" }: { className?: string }) => (
  <div
    className={cx(
      "h-4 w-full rounded-md bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200",
      "skeleton-shimmer",
      className,
    )}
  />
);

export default function SkeletonLoader({
  lines = 3,
  showAvatar = false,
  showFooter = false,
  children,
  className = "",
}: SkeletonLoaderProps) {
  const safeLines = Number.isFinite(lines) && lines > 0 ? Math.min(Math.floor(lines), 6) : 3;

  return (
    <div
      className={cx(
        "w-full rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm",
        "skeleton-card",
        className,
      )}
    >
      <div className={cx("flex items-start gap-4", showAvatar ? "" : "pb-1")}>
        {showAvatar && (
          <div className="h-12 w-12 rounded-full bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 skeleton-shimmer" />
        )}
        <div className="flex-1 space-y-3">
          {Array.from({ length: safeLines }).map((_, index) => (
            <SkeletonBar key={`skeleton-line-${index}`} className={index === 0 ? "w-3/4" : undefined} />
          ))}
        </div>
      </div>
      {showFooter && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <SkeletonBar className="h-3 w-3/4" />
          <SkeletonBar className="h-3 w-2/3" />
          <SkeletonBar className="h-3 w-1/2" />
        </div>
      )}
      {children && <div className="mt-4 text-xs text-gray-400">{children}</div>}
    </div>
  );
}
