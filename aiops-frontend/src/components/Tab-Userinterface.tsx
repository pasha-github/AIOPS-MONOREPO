"use client";

type TabUserinterfaceProps = {
  tabs: readonly string[];
  activeIndex: number;
  onChange: (index: number) => void;
  minWidthClassName?: string;
  gridClassName?: string;
  className?: string;
};

export default function TabUserinterface({
  tabs,
  activeIndex,
  onChange,
  minWidthClassName = "min-w-[560px]",
  gridClassName,
  className = "",
}: TabUserinterfaceProps) {
  return (
    <div className={`w-full overflow-x-auto p-2 ${className}`}>
      <div
        className={`grid ${minWidthClassName} ${gridClassName ?? ""} gap-2 rounded-xl bg-white p-1`}
        style={
          gridClassName
            ? undefined
            : { gridTemplateColumns: `repeat(${Math.max(tabs.length, 1)}, minmax(0, 1fr))` }
        }
      >
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(index)}
            className={`min-h-9 rounded-lg px-3 py-2 text-center text-xs font-semibold leading-tight transition ${
              activeIndex === index
                ? "bg-indigo-600 text-white shadow-[0_12px_22px_-18px_rgba(79,70,229,0.9)]"
                : "text-gray-500 hover:bg-indigo-50 hover:text-indigo-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
