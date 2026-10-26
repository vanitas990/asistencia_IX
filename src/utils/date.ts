export function formatLocalTimestamp(value: string) {
  const match = value.match(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/i,
  );
  let normalizedValue = value;

  if (match) {
    const [, date, time, rawOffset] = match;
    let offset = rawOffset?.toUpperCase() === 'Z' ? 'Z' : rawOffset ?? 'Z';
    if (/^[+-]\d{2}$/.test(offset)) {
      offset = `${offset}:00`;
    } else if (/^[+-]\d{4}$/.test(offset)) {
      offset = `${offset.slice(0, 3)}:${offset.slice(3)}`;
    }
    normalizedValue = `${date}T${time}${offset}`;
  }

  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';

  const localDate = date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const localTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return `${localDate} - ${localTime}`;
}
