import type { InputHTMLAttributes, ReactNode } from 'react';

interface NesFieldProps {
  label: string;
  htmlFor?: string;
  children?: ReactNode;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export function NesField({ label, htmlFor, children, inputProps }: NesFieldProps) {
  const id = htmlFor ?? inputProps?.id;
  return (
    <div className="nes-field">
      <label className="nes-field__label" htmlFor={id}>{label}</label>
      {children ?? (inputProps ? <input className="nes-input" {...inputProps} id={id} /> : null)}
    </div>
  );
}
