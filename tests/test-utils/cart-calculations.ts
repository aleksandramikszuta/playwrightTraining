export interface CartCalculationItem {
  unitPriceInCents: number;
  quantity: number;
}

export function moneyInCents(displayedAmount: string): number {
  const amount = displayedAmount.match(/-?\s*(?:(?:\d{1,3}(?:,\d{3})+)|\d+)(?:\.\d{1,2})?/);

  if (amount === null) {
    throw new Error(`Could not parse a monetary amount from "${displayedAmount}".`);
  }

  const normalizedAmount = amount[0].replace(/[\s,]/g, '');
  const isNegative = normalizedAmount.startsWith('-');
  const [wholeUnits, fractionalUnits = ''] = normalizedAmount.replace('-', '').split('.');
  const cents = Number(wholeUnits) * 100 + Number(fractionalUnits.padEnd(2, '0'));

  return isNegative ? -cents : cents;
}

export function calculateSubtotalInCents(items: CartCalculationItem[]): number {
  return items.reduce((subtotal, item) => subtotal + item.unitPriceInCents * item.quantity, 0);
}

export function calculateCartTotalInCents({
  items,
  deliveryInCents,
  taxInCents = 0,
  discountsInCents = 0,
}: {
  items: CartCalculationItem[];
  deliveryInCents: number;
  taxInCents?: number;
  discountsInCents?: number;
}): number {
  return calculateSubtotalInCents(items) - discountsInCents + deliveryInCents + taxInCents;
}
