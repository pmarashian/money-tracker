import { RR_CURSOR_DQ } from './constants';

export interface RrMenuOption<T extends string> {
  value: T;
  label: string;
}

interface RrMenuPickerProps<T extends string> {
  value: T;
  options: RrMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function RrMenuPicker<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: RrMenuPickerProps<T>) {
  return (
    <div className="rr-menu" role="radiogroup" aria-label={ariaLabel}>
      <ol className="rr-cmd-list">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <li key={opt.value}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className="rr-cmd-item"
                aria-selected={selected}
                onClick={() => onChange(opt.value)}
              >
                <img className="rr-cursor rr-cursor--dq" src={RR_CURSOR_DQ} alt="" />
                <span className="rr-cmd-item__text">{opt.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
