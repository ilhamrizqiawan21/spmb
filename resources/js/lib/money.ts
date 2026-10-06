const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Format a decimal string from the API (e.g. "1000000.00") as Rupiah. Amounts stay strings end to end. */
export function rupiah(amount: string): string {
  const n = Number(amount)
  return Number.isFinite(n) ? idr.format(n) : amount
}

/** Whole cents of a decimal string; avoids float drift when comparing amounts for display. */
export function cents(amount: string): number {
  return Math.round(Number(amount) * 100)
}

export function fromCents(value: number): string {
  return (value / 100).toFixed(2)
}
