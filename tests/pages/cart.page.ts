import type { Locator, Page } from '@playwright/test';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface CartItemSummary {
  name: string;
  unitPrice: string;
  discountedUnitPrice: string | null;
  quantity: number;
  linePrice: string;
}

export class CartPage {
  readonly productTitles: Locator;
  readonly productQuantity: Locator;
  readonly productPrice: Locator;
  readonly linePrice: Locator;
  readonly total: Locator;
  readonly subtotal: Locator;
  readonly deliveryCost: Locator;
  readonly tax: Locator;
  readonly cartDiscount: Locator;
  readonly ecoDiscount: Locator;
  readonly emptyCartMessage: Locator;
  private readonly quantityUpdatedMessage: Locator;
  private readonly cartRows: Locator;

  constructor(private readonly page: Page) {
    this.productTitles = page.locator('[data-test="product-title"]');
    this.productQuantity = page.locator('[data-test="product-quantity"]');
    this.productPrice = page.locator('[data-test="product-price"]');
    this.linePrice = page.locator('[data-test="line-price"]');
    this.total = page.locator('[data-test="cart-total"]');
    this.subtotal = page.locator('[data-test="cart-subtotal"]');
    this.deliveryCost = page.locator('[data-test="cart-delivery-cost"]');
    this.tax = page.locator('[data-test="cart-tax"]');
    this.cartDiscount = page.locator('[data-test="cart-discount"]');
    this.ecoDiscount = page.locator('[data-test="cart-eco-discount"]');
    this.emptyCartMessage = page.locator('app-cart p');
    this.quantityUpdatedMessage = page.getByRole('alert').filter({
      hasText: 'Product quantity updated.',
    });
    this.cartRows = page.locator('tbody tr').filter({
      has: page.locator('[data-test="product-title"]'),
    });
  }

  async open() {
    await this.page.locator('[data-test="nav-cart"]').click();
    await this.page.waitForURL('**/checkout');
  }

  async getCartItems(): Promise<CartItemSummary[]> {
    const items: CartItemSummary[] = [];

    for (const row of await this.cartRows.all()) {
      const title = (await row.locator('[data-test="product-title"]').innerText()).trim();
      const name = title.replace(/\s*-\d+%\s*$/, '').trim();
      const discountedUnitPrice = row.locator('[data-test="offer-price"]').first();

      items.push({
        name,
        unitPrice: (await row.locator('[data-test="product-price"]').innerText()).trim(),
        discountedUnitPrice:
          (await discountedUnitPrice.count()) > 0
            ? (await discountedUnitPrice.innerText()).trim()
            : null,
        quantity: Number(await row.locator('[data-test="product-quantity"]').inputValue()),
        linePrice: (await row.locator('[data-test="line-price"]').innerText()).trim(),
      });
    }

    return items;
  }

  async getProductName(index: number) {
    return (await this.getCartItems())[index]?.name;
  }

  async getProductPrice(productName: string) {
    return (await this.getProductRow(productName).locator('[data-test="product-price"]').innerText()).trim();
  }

  async getProductQuantity(productName: string) {
    return Number(await this.getProductRow(productName).locator('[data-test="product-quantity"]').inputValue());
  }

  getProductQuantityInput(productName: string) {
    return this.getProductRow(productName).locator('[data-test="product-quantity"]');
  }

  getProductLinePrice(productName: string) {
    return this.getProductRow(productName).locator('[data-test="line-price"]');
  }

  async increaseQuantity(productName: string) {
    await this.setQuantity(productName, (await this.getProductQuantity(productName)) + 1);
  }

  async decreaseQuantity(productName: string) {
    await this.setQuantity(productName, (await this.getProductQuantity(productName)) - 1);
  }

  async setQuantity(productName: string, quantity: number) {
    if ((await this.getProductQuantity(productName)) === quantity) {
      return;
    }

    const quantityInput = this.getProductQuantityInput(productName);
    await this.quantityUpdatedMessage.waitFor({ state: 'hidden' });

    await quantityInput.fill(String(quantity));
    await quantityInput.press('Tab');
    await this.quantityUpdatedMessage.waitFor({ state: 'visible' });
  }

  async removeProduct(productName: string) {
    const productRow = this.getProductRow(productName);
    await productRow.locator('a.btn-danger').click();
    await productRow.waitFor({ state: 'detached' });
  }

  async getSubtotal() {
    return (await this.subtotal.count()) > 0 ? (await this.subtotal.innerText()).trim() : null;
  }

  async getTotal() {
    return (await this.total.innerText()).trim();
  }

  async getDeliveryCost() {
    return this.getOptionalAmount(this.deliveryCost);
  }

  async getTax() {
    return this.getOptionalAmount(this.tax);
  }

  async getCartDiscount() {
    return this.getOptionalAmount(this.cartDiscount);
  }

  async getEcoDiscount() {
    return this.getOptionalAmount(this.ecoDiscount);
  }

  async getEmptyCartMessage() {
    return (await this.emptyCartMessage.innerText()).trim();
  }

  private getProductRow(productName: string) {
    return this.cartRows.filter({
      hasText: new RegExp(`^${escapeRegExp(productName)}(?:\\s|$)`),
    });
  }

  private async getOptionalAmount(locator: Locator) {
    return (await locator.count()) > 0 ? (await locator.innerText()).trim() : null;
  }
}
