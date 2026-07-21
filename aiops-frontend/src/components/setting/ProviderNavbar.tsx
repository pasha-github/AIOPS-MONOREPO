import type { ProviderOption, ProviderKey } from "./types";

type ProviderNavbarProps = {
  providers: ProviderOption[];
  provider: ProviderKey;
  onSelect: (provider: ProviderKey) => void;
};

export default function ProviderNavbar({ providers, provider, onSelect }: ProviderNavbarProps) {
  return (
    <aside className="w-56 shrink-0 border-r border-[#e9edf6] bg-[#fbfcff] px-4 py-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b]">
        Providers
      </p>
      <div className="space-y-2">
        {providers.map((item) => {
          const logoKey = item.logoKey ?? item.key;
          const isWhiteBgLogo = logoKey === "google";
          return (
          <button
            key={item.key}
            type="button"
            disabled={item.disable}
            onClick={() => onSelect(item.key)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              item.disable
                ? "cursor-not-allowed border-[#e5e7eb] bg-[#f3f4f6] text-[#9ca3af]"
                : provider === item.key
                  ? "border-[#4f49e2] bg-[#eef2ff] text-[#3f35d3]"
                  : "border-[#e5eaf4] bg-white text-[#475569] hover:bg-[#f8fafc]"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <img
                src={`/img/${logoKey}.webp`}
                alt={`${item.label} logo`}
                onError={(event) => {
                  const image = event.currentTarget;
                  if (!image.src.endsWith(".png")) {
                    image.src = `/img/${logoKey}.png`;
                    return;
                  }
                  image.style.display = "none";
                }}
                className={`h-5 w-5 object-contain ${
                  isWhiteBgLogo ? "mix-blend-multiply" : ""
                } ${item.disable ? "opacity-70" : ""}`}
              />
              <span>{item.label}</span>
            </span>
            {!item.available ? <span className="text-xs text-[#94a3b8]">Soon</span> : null}
          </button>
          );
        })}
      </div>
    </aside>
  );
}
