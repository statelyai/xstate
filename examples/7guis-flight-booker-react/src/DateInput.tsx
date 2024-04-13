export const DateInput: React.FC<{
  value?: string | Date;
  onChange: (value: string) => void;
  disabled?: boolean;
  label: string;
}> = ({ value, onChange, disabled, label }) => {
  return (
    <div className="text-input">
      <label>
        <span className="visually-hidden">{label}: </span>
        <input
          type="date"
          onChange={(e) => {
            onChange(e.target.value);
          }}
          value={value?.toString()}
          disabled={disabled}
        />
      </label>
    </div>
  );
};
