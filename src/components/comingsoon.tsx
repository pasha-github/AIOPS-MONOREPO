type ComingSoonProps = {
  variant?: "ribbon" | "badge";
  className?: string;
};

export default function ComingSoonCornerRibbon({
  variant = "ribbon",
  className = "",
}: ComingSoonProps) {
  if (variant === "badge") {
    return (
      <span
        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#dc2626] ${className}`}
      >
        Coming Soon
      </span>
    );
  }

  return (
    <div
      className={`pointer-events-none absolute right-0 top-0 h-24 w-24 overflow-hidden rounded-tr-2xl ${className}`}
    >
      <div className="absolute right-[-34px] top-[14px] flex w-[140px] rotate-45 items-center justify-center gap-1.5 bg-gradient-to-r from-red-600 to-red-500 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-md">
        <span>Coming Soon</span>
      </div>
    </div>
  );
}
