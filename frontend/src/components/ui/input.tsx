// Input teks berlabel — mobile-first
import type { InputHTMLAttributes } from 'react';

export function Input({
  label,
  galat,
  className = '',
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; galat?: string }) {
  const inputId = id || props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`min-h-tap w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-light ${galat ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {galat && <p className="mt-1 text-sm text-red-600">{galat}</p>}
    </div>
  );
}
