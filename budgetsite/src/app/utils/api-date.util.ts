function pad(value: number, length = 2): string {
  return value.toString().padStart(length, '0');
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.000`;
}

export function toApiLocalDateTime(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);

    if (hasExplicitTimezone) {
      date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : formatLocalDate(date);
    }

    const parts = value.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/
    );
    if (!parts) return value;

    const [, year, month, day, hour = '00', minute = '00', second = '00'] = parts;
    const yearNumber = Number(year);
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    const hourNumber = Number(hour);
    const minuteNumber = Number(minute);
    const secondNumber = Number(second);
    const validationDate = new Date(0);
    validationDate.setFullYear(yearNumber, monthNumber - 1, dayNumber);
    validationDate.setHours(hourNumber, minuteNumber, secondNumber, 0);

    if (
      validationDate.getFullYear() !== yearNumber ||
      validationDate.getMonth() !== monthNumber - 1 ||
      validationDate.getDate() !== dayNumber ||
      validationDate.getHours() !== hourNumber ||
      validationDate.getMinutes() !== minuteNumber ||
      validationDate.getSeconds() !== secondNumber
    ) {
      return value;
    }

    return `${year}-${month}-${day}T${hour}:${minute}:${second}.000`;
  } else {
    const momentLike = value as { toDate?: () => unknown };
    if (typeof momentLike.toDate !== 'function') return value;

    try {
      const converted = momentLike.toDate();
      if (!(converted instanceof Date)) return value;
      date = converted;
    } catch {
      return value;
    }
  }

  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return value;

  return formatLocalDate(date);
}

export function prepareApiDates<T extends object>(payload: T, fields: Array<keyof T>): T {
  const prepared = { ...payload };
  fields.forEach((field) => {
    Object.assign(prepared, { [field]: toApiLocalDateTime(prepared[field]) });
  });
  return prepared;
}
