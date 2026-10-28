const STUDIO_LOCALE = "en-KE";

/** Formats integer minor units, e.g. 150000 KES -> "KES 1,500". */
export function formatPrice(priceMinor: number, currency: string): string {
  const amount = priceMinor / 100;
  return new Intl.NumberFormat(STUDIO_LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  })
    .format(amount)
    .replace(/ /g, " ");
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
