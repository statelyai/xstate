export function parseDurationToMilliseconds(
  duration: string
): number | undefined {
  const normalizedDuration = duration.trim();

  const millisecondsMatch = normalizedDuration.match(/^(\d+)ms$/i);
  if (millisecondsMatch) {
    return +millisecondsMatch[1];
  }

  if (/^\d*\.?\d*s$/i.test(normalizedDuration)) {
    return Math.floor((parseFloat(normalizedDuration) || 0) * 1000);
  }

  const iso8601DurationMatch = normalizedDuration.match(
    /^P(?:(?<weeks>\d+(?:[.,]\d+)?)W)?(?:(?<days>\d+(?:[.,]\d+)?)D)?(?:T(?:(?<hours>\d+(?:[.,]\d+)?)H)?(?:(?<minutes>\d+(?:[.,]\d+)?)M)?(?:(?<seconds>\d+(?:[.,]\d+)?)S)?)?$/i
  );

  if (!iso8601DurationMatch?.groups) {
    return undefined;
  }

  const groups = iso8601DurationMatch.groups;
  const units = ['weeks', 'days', 'hours', 'minutes', 'seconds'] as const;
  if (!units.some((unit) => groups[unit])) {
    return undefined;
  }

  return units.reduce(
    (total, unit, index) =>
      total +
      +(groups[unit]?.replace(',', '.') ?? 0) *
        [604_800_000, 86_400_000, 3_600_000, 60_000, 1000][index],
    0
  );
}

export function parseDelayToMilliseconds(
  delay: string | number | undefined
): number | undefined {
  if (delay === undefined) {
    return undefined;
  }

  if (typeof delay === 'number') {
    return delay;
  }

  return parseDurationToMilliseconds(delay);
}
