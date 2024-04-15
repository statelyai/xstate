type Props = {
  isValidDate: boolean;
} & Input;

function DateInput({ isValidDate, ...props }: Props) {
  return (
    <label>
      <span className="visually-hidden">{props.id}</span>
      <input type="date" {...props} className={isValidDate ? "" : "error"} />
    </label>
  );
}

export default DateInput;
