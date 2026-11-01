import type { Locator, Page } from '@playwright/test';

export class ProductsPage {
  readonly productNames: Locator;
  private readonly sortSelect: Locator;
  private readonly nextPageButton: Locator;

  constructor(private readonly page: Page) {
    this.productNames = page.locator('[data-test="product-name"]');
    this.sortSelect = page.locator('[data-test="sort"]');
    this.nextPageButton = page.getByRole('button', { name: 'Next' });
  }

  async goto() {
    await this.page.goto('https://practicesoftwaretesting.com/');
  }

  async sortByName(direction: 'asc' | 'desc') {
    await this.sortSelect.selectOption(`name,${direction}`);
  }

  async goToNextPage() {
    await this.nextPageButton.click();
  }

  async getProductNames() {
    return (await this.productNames.allTextContents()).map(name => name.trim());
  }
}