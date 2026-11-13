// Decimal strings at six places; BigInt arithmetic, integer cents at total boundaries.
export const DECIMAL_SCALE = 1_000_000n;
export function decimalUnits(value, { allowNegative = false } = {}) {
  if (typeof value === "number" && Number.isSafeInteger(value))
    value = String(value);
  if (
    typeof value !== "string" ||
    !new RegExp(`^${allowNegative ? "-?" : ""}\\d{1,12}(?:\\.\\d{1,6})?$`).test(
      value.trim(),
    )
  )
    throw new Error("Use a decimal value with at most six decimal places.");
  const text = value.trim(),
    negative = text.startsWith("-"),
    [whole, fraction = ""] = text.replace("-", "").split(".");
  return (
    (BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(6, "0"))) *
    (negative ? -1n : 1n)
  );
}
export function decimalString(units) {
  const sign = units < 0n ? "-" : "";
  units = units < 0n ? -units : units;
  const tail = String(units % DECIMAL_SCALE)
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${sign}${units / DECIMAL_SCALE}${tail ? "." + tail : ""}`;
}
export const normalDecimal = (value) => decimalString(decimalUnits(value));
export function roundedDivision(numerator, denominator) {
  if (denominator <= 0n) throw new Error("Conversion must be positive.");
  const negative = numerator < 0n,
    n = negative ? -numerator : numerator;
  const rounded = (n + denominator / 2n) / denominator;
  return negative ? -rounded : rounded;
}
function safeInteger(n) {
  if (
    n > BigInt(Number.MAX_SAFE_INTEGER) ||
    n < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new Error("The monetary amount is too large.");
  return Number(n);
}
export function lineCents(quantity, rate) {
  return safeInteger(
    roundedDivision(
      decimalUnits(quantity) * decimalUnits(rate),
      10_000_000_000n,
    ),
  );
}
export function money(cents) {
  if (!Number.isSafeInteger(cents))
    throw new Error("Expected integer NZD cents.");
  const units = BigInt(cents),
    absolute = units < 0n ? -units : units;
  const whole =
    units < 0n ? (absolute < 100n ? -0 : -(absolute / 100n)) : absolute / 100n;
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  })
    .formatToParts(whole)
    .map((part) =>
      part.type === "fraction"
        ? String(absolute % 100n).padStart(2, "0")
        : part.value,
    )
    .join("");
}
export function convertedUnitCost(purchaseRate, unitsPerPurchase) {
  return decimalString(
    roundedDivision(
      decimalUnits(purchaseRate) * DECIMAL_SCALE,
      decimalUnits(unitsPerPurchase),
    ),
  );
}
export function profitSummary(sellRate, buyRate) {
  const sell = decimalUnits(sellRate),
    buy = decimalUnits(buyRate),
    percent = sell === 0n ? null : roundedDivision((sell - buy) * 10000n, sell),
    absolute = percent === null ? null : percent < 0n ? -percent : percent;
  return {
    profitRate: decimalString(sell - buy),
    marginPercent:
      percent === null
        ? null
        : `${percent < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`,
  };
}
export function quoteAmounts(lines, taxBps) {
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 10000)
    throw new Error("Enter a valid tax rate.");
  const amounts = lines.map((l) => lineCents(l.quantity, l.sellRate));
  const subtotal = safeInteger(amounts.reduce((s, n) => s + BigInt(n), 0n)),
    tax = safeInteger(
      roundedDivision(BigInt(subtotal) * BigInt(taxBps), 10000n),
    );
  return {
    lineAmounts: amounts,
    subtotalCents: subtotal,
    taxCents: tax,
    totalCents: safeInteger(BigInt(subtotal) + BigInt(tax)),
  };
}
