export function parseDurationToMilliseconds(
  duration: string
): number | undefined {
  const normalizedDuration = duration.trim();

  const millisecondsMatch = normalizedDuration.match(/^(\d+)ms$/i);
  if (millisecondsMatch) {
    return parseInt(millisecondsMatch[1], 10);
  }

  const secondsMatch = normalizedDuration.match(/^(\d*)(\.?)(\d*)s$/i);
  if (secondsMatch) {
    const wholePart = secondsMatch[1] ? parseInt(secondsMatch[1], 10) : 0;
    const hasDecimal = !!secondsMatch[2];
    const fracPart = secondsMatch[3]
      ? parseInt(secondsMatch[3].padEnd(3, '0').slice(0, 3), 10)
      : 0;

    return wholePart * 1000 + (hasDecimal ? fracPart : 0);
  }

  const iso8601DurationMatch = normalizedDuration.match(
    /^P(?:(?<weeks>\d+(?:[.,]\d+)?)W)?(?:(?<days>\d+(?:[.,]\d+)?)D)?(?:T(?:(?<hours>\d+(?:[.,]\d+)?)H)?(?:(?<minutes>\d+(?:[.,]\d+)?)M)?(?:(?<seconds>\d+(?:[.,]\d+)?)S)?)?$/i
  );

  if (!iso8601DurationMatch?.groups) {
    return undefined;
  }

  const { weeks, days, hours, minutes, seconds } = iso8601DurationMatch.groups;
  if (!weeks && !days && !hours && !minutes && !seconds) {
    return undefined;
  }

  const toNumber = (value: string | undefined) =>
    value ? Number(value.replace(',', '.')) : 0;

  return (
    toNumber(weeks) * 7 * 24 * 60 * 60 * 1000 +
    toNumber(days) * 24 * 60 * 60 * 1000 +
    toNumber(hours) * 60 * 60 * 1000 +
    toNumber(minutes) * 60 * 1000 +
    toNumber(seconds) * 1000
  );
}
