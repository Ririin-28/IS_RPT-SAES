type FlashcardsStatusScreenProps = {
  title: string;
  message: string;
  tone?: "loading" | "error";
  actionLabel?: string;
  onAction?: () => void;
};

export default function FlashcardsStatusScreen({
  title,
  message,
  tone = "loading",
  actionLabel,
  onAction,
}: FlashcardsStatusScreenProps) {
  const isLoading = tone === "loading";

  return (
    <div className="min-h-screen bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white/80 shadow-[0_24px_60px_-30px_rgba(1,51,0,0.35)] backdrop-blur-xl px-8 py-10 text-center">
        {isLoading ? (
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#013300]/10 border-t-[#013300]" />
        ) : (
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-red-200 bg-red-50 text-lg font-bold text-red-600">
            !
          </div>
        )}
        <p className="text-lg font-semibold text-slate-900">{title}</p>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-[#013300] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b4a0b]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
