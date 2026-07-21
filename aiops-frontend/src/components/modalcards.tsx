"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { forwardRef } from "react";
import { X } from "lucide-react";

type ModalCardProps = {
  children: ReactNode;
  zIndexClassName?: string;
  onBackdropClick?: () => void;
};

type ModalCardPanelProps = ComponentPropsWithoutRef<"div"> & {
  maxWidthClassName?: string;
};

type ModalCardHeaderProps = {
  title: string;
  subtitle?: string | null;
  icon?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  className?: string;
};

type ModalCardSectionProps = {
  children: ReactNode;
  className?: string;
};

export function ModalCard({
  children,
  zIndexClassName = "z-[90]",
  onBackdropClick,
}: ModalCardProps) {
  return (
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-black/35 px-4 py-8 backdrop-blur-sm`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onBackdropClick?.();
        }
      }}
    >
      {children}
    </div>
  );
}

export const ModalCardPanel = forwardRef<HTMLDivElement, ModalCardPanelProps>(
  function ModalCardPanel(
    { children, maxWidthClassName = "max-w-lg", className = "", ...props },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={`flex max-h-[90vh] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-35px_rgba(15,23,42,0.65)] ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

export function ModalCardHeader({
  title,
  subtitle,
  icon,
  actions,
  onClose,
  className = "",
}: ModalCardHeaderProps) {
  return (
    <div className={`flex items-center justify-between bg-[#4f49e2] px-6 py-4 text-white ${className}`}>
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            {icon}
          </span>
        ) : null}
        <div>
          <p className="text-lg font-semibold">{title}</p>
          {subtitle ? <p className="text-xs text-white/80">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ModalCardBody({
  children,
  className = "",
}: ModalCardSectionProps) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

export function ModalCardFooter({
  children,
  className = "",
}: ModalCardSectionProps) {
  return (
    <div className={`flex items-center justify-end gap-3 border-t border-[#eef1f7] px-6 py-4 ${className}`}>
      {children}
    </div>
  );
}

export function ModalCardRequiredNote({
  visible = true,
  className = "",
}: {
  visible?: boolean;
  className?: string;
}) {
  if (!visible) {
    return null;
  }

  return (
    <p className={`text-xs text-gray-400 ${className}`}>
      Fields marked <span className="text-red-400">*</span> are required
    </p>
  );
}
