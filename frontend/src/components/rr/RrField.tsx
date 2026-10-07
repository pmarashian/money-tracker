import type { InputHTMLAttributes, ReactNode } from 'react';

interface RrFieldProps {
  label: string;
  htmlFor?: string;
  children?: ReactNode;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export function RrField({ label, htmlFor, children, inputProps }: RrFieldProps) {
  const id = htmlFor ?? inputProps?.id;
  return (
    <div className="rr-field">
      <label className="rr-field__label" htmlFor={id}>{label}</label>
      {children ?? (inputProps ? <input className="rr-input" {...inputProps} id={id} /> : null)}
    </div>
  );
}
