import type { Locator, Page } from '@playwright/test';

export class CartPage {
  readonly productTitles: Locator;
  readonly productQuantity: Locator;
  readonly productPrice: Locator;
  readonly linePrice: Locator;
  readonly total: Locator;

  constructor(private readonly page: Page) {
    this.productTitles = page.locator('[data-test="product-title"]');
    this.productQuantity = page.locator('[data-test="product-quantity"]');
    this.productPrice = page.locator('[data-test="product-price"]');
    this.linePrice = page.locator('[data-test="line-price"]');
    this.total = page.locator('[data-test="cart-total"]');
  }

  async open() {
    await this.page.locator('[data-test="nav-cart"]').click();
    await this.productTitles.first().waitFor({ state: 'visible' });
  }
}
