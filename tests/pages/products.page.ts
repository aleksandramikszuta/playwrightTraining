import type { Locator, Page } from '@playwright/test';

export interface ProductSummary {
  name: string;
  price: string;
  outOfStock: boolean;
  index: number;
}

export class ProductsPage {
  readonly productNames: Locator;
  private readonly sortSelect: Locator;
  private readonly nextPageButton: Locator;
  private readonly searchInput: Locator;
  private readonly searchButton: Locator;
  readonly searchHeading: Locator;
  readonly searchResultSummary: Locator;
  private readonly productCards: Locator;

  constructor(private readonly page: Page) {
    this.productNames = page.locator('[data-test="product-name"]');
    this.sortSelect = page.locator('[data-test="sort"]');
    this.nextPageButton = page.getByRole('button', { name: 'Next' });
    this.searchInput = page.getByPlaceholder('Search');
    this.searchButton = page.getByRole('button', { name: 'Search' });
    this.searchHeading = page.getByRole('heading', { name: /Searched for:/ });
    this.searchResultSummary = page.locator('p').filter({ hasText: /products? found for/i });
    this.productCards = page.locator('a[href^="/product/"]:has([data-test="product-name"])');
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
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

  async searchFor(query: string) {
    await this.searchInput.fill(query);
    await this.searchButton.click();
    await this.searchResultSummary.waitFor({ state: 'visible' });
  }

  async getSearchResultCount() {
    const summary = await this.searchResultSummary.innerText();
    const count = summary.match(/(\d+) products? found for/i)?.[1];

    if (count === undefined) {
      throw new Error(`Could not read the search result count from "${summary}".`);
    }

    return Number(count);
  }

  async getProductSummaries(): Promise<ProductSummary[]> {
    const summaries: ProductSummary[] = [];
    const cards = await this.productCards.all();

    for (const [index, card] of cards.entries()) {
      summaries.push({
        name: (await card.locator('[data-test="product-name"]').innerText()).trim(),
        price: (await card.locator('[data-test="product-price"]').innerText()).trim(),
        outOfStock: (await card.getByText('Out of stock', { exact: true }).count()) > 0,
        index,
      });
    }

    return summaries;
  }

  async openProduct(index: number) {
    await this.productCards.nth(index).click();
  }
}