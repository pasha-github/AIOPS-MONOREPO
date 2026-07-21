"use client";

import { Search } from "lucide-react";
import { useState } from "react";

type SearchbarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  name?: string;
  readOnly?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  autoCorrect?: string;
  autoCapitalize?: string;
  spellCheck?: boolean;
  withFocusExpand?: boolean;
  collapsedWidthClass?: string;
  expandedWidthClass?: string;
  wrapperClassName?: string;
  inputClassName?: string;
  iconClassName?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

export default function Searchbar({
  value,
  onChange,
  placeholder,
  name = "search",
  readOnly = false,
  disabled = false,
  autoComplete = "off",
  autoCorrect = "off",
  autoCapitalize = "none",
  spellCheck = false,
  withFocusExpand = true,
  collapsedWidthClass = "w-44",
  expandedWidthClass = "w-64",
  wrapperClassName = "rounded-xl bg-[#eef2ff] px-4 py-2 text-sm text-[#4f49e2]",
  inputClassName = "w-full bg-transparent text-sm text-[#4f49e2] placeholder:text-[#4f49e2] focus:outline-none",
  iconClassName = "h-4 w-4",
  onFocus,
  onBlur,
}: SearchbarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const widthClass = withFocusExpand
    ? isFocused
      ? expandedWidthClass
      : collapsedWidthClass
    : expandedWidthClass;

  return (
    <div
      className={`flex items-center gap-2 transition-all duration-200 ${widthClass} ${wrapperClassName}`}
    >
      <Search className={iconClassName} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          setIsFocused(true);
          onFocus?.();
        }}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        placeholder={placeholder}
        name={name}
        autoComplete={autoComplete}
        autoCorrect={autoCorrect}
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        readOnly={readOnly}
        disabled={disabled}
        className={inputClassName}
      />
    </div>
  );
}
