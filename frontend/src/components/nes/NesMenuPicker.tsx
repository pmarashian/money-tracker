export interface NesMenuOption<T extends string> {
  value: T;
  label: string;
}

interface NesMenuPickerProps<T extends string> {
  value: T;
  options: NesMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

export function NesMenuPicker<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: NesMenuPickerProps<T>) {
  return (
    <div className="nes-menu" role="radiogroup" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`nes-menu__item${selected ? ' nes-menu__item--selected' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            <span className="nes-menu__cursor" aria-hidden>{selected ? '▶' : '\u00a0'}</span>
            <span className="nes-menu__text">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
