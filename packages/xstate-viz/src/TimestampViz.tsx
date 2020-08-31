export const TimestampViz: React.FC<{ time: number }> = ({ time }) => {
  return <div data-xviz="timestamp">{new Date(time).toLocaleTimeString()}</div>;
};
