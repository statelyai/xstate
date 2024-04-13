type Props = {
  isValidDate: boolean;
} & Input;

function DateInput({ isValidDate, ...props }: Props) {
  return (
    <label>
      <span className="visually-hidden">{props.id}</span>
      <input type="date" {...props} style={isValidDate ? null : errorStyle} />
    </label>
  );
}

const errorStyle = {
  color: "white",
  background: "red",
  fontWeight: "700",
};

export default DateInput;
