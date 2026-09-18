import { useField } from 'formik';
import { SearchableSelect, type SelectOption } from '../ui/SearchableSelect';

type Props = {
  name: string;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  isMulti?: boolean;
  isClearable?: boolean;
  hint?: string;
};

export function FormSelect({
  name,
  label,
  options,
  placeholder,
  isMulti = false,
  isClearable = true,
  hint,
}: Props) {
  const [field, meta, helpers] = useField(name);
  const error = meta.touched && meta.error ? meta.error : undefined;

  const value = isMulti
    ? options.filter((opt) => Array.isArray(field.value) && field.value.includes(opt.value))
    : options.find((opt) => opt.value === field.value) ?? null;

  return (
    <SearchableSelect
      label={label}
      options={options}
      placeholder={placeholder}
      isMulti={isMulti}
      isClearable={isClearable}
      error={error}
      hint={hint}
      value={value}
      onChange={(selected) => {
        if (isMulti) {
          const values = Array.isArray(selected) ? selected.map((s) => s.value) : [];
          void helpers.setValue(values);
        } else {
          const single = selected as SelectOption | null;
          void helpers.setValue(single?.value ?? '');
        }
      }}
      onBlur={() => helpers.setTouched(true)}
    />
  );
}
