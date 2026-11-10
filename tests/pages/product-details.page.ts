import type { Locator, Page } from '@playwright/test';

export class ProductDetailsPage {
  readonly productName: Locator;
  readonly unitPrice: Locator;
  readonly addToCartButton: Locator;
  readonly addedToCartMessage: Locator;

  constructor(page: Page) {
    this.productName = page.locator('[data-test="product-name"]');
    this.unitPrice = page.locator('[data-test="unit-price"]');
    this.addToCartButton = page.getByRole('button', { name: 'Add to cart' });
    this.addedToCartMessage = page.getByRole('alert');
  }

  async addToCart() {
    await this.addToCartButton.click();
  }
}
