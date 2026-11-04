import type { ReactNode } from 'react';

export function Field({ label, id, required, error, children }: {
  label: string; id: string; required?: boolean; error?: boolean; children: ReactNode;
}) {
  return <div className="field">
    <label htmlFor={id}>{label}{required && <span className="required-mark"> *</span>}</label>
    {children}
    {error && <span className="field-error">This field is required.</span>}
  </div>;
}
