import { test, expect } from '@playwright/test';
import { ProductsPage } from './pages/products.page';

const productsPerPage = 9;

type SortDirection = 'asc' | 'desc';

function getSortedNames(names: string[], direction: SortDirection) {
  const sortedNames = [...names].sort((first, second) => first.localeCompare(second));
  return direction === 'asc' ? sortedNames : sortedNames.reverse();
}

async function expectSortedProductNames(productsPage: ProductsPage, direction: SortDirection) {
  await expect(productsPage.productNames).toHaveCount(productsPerPage);
  await expect.poll(async () => {
    const names = await productsPage.getProductNames();
    return names.join('\n') === getSortedNames(names, direction).join('\n');
  }).toBe(true);
  return productsPage.getProductNames();
}

for (const { direction, sortValue, label } of [
  { direction: 'asc', sortValue: 'name,asc', label: 'A - Z' },
  { direction: 'desc', sortValue: 'name,desc', label: 'Z - A' },
] as const) {
  test(`sorts product names ${label} across pages`, async ({ page }) => {
    const productsPage = new ProductsPage(page);
    await productsPage.goto();
    await productsPage.sortByName(direction);

    const firstPageNames = await expectSortedProductNames(productsPage, direction);

    await productsPage.goToNextPage();
    await expect.poll(() => productsPage.getProductNames()).not.toEqual(firstPageNames);
    const secondPageNames = await expectSortedProductNames(productsPage, direction);

    expect(secondPageNames).not.toEqual(firstPageNames);
  });
}
