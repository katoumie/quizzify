// /src/components/icons/CaretDownIcon.tsx
"use client";

export default function CaretDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`block ${className}`} fill="currentColor" aria-hidden="true">
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}
