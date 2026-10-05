export function relativeTime(value: string, locale: string, now: string) {
  const seconds = (new Date(value).getTime() - new Date(now).getTime()) / 1000;
  const magnitude = Math.abs(seconds);
  const [unit, divisor]: [Intl.RelativeTimeFormatUnit, number] =
    magnitude < 60
      ? ['second', 1]
      : magnitude < 3600
        ? ['minute', 60]
        : magnitude < 86400
          ? ['hour', 3600]
          : magnitude < 604800
            ? ['day', 86400]
            : magnitude < 2592000
              ? ['week', 604800]
              : magnitude < 31536000
                ? ['month', 2592000]
                : ['year', 31536000];
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
    Math.round(seconds / divisor),
    unit,
  );
}
