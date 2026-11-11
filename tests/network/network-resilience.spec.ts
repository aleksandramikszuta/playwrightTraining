import { expect, test, type Page } from '@playwright/test';
import { CartPage } from '../pages/cart.page';
import { ProductDetailsPage } from '../pages/product-details.page';
import { ProductsPage } from '../pages/products.page';
import {
  isProductDetailUrl,
  isProductListUrl,
  isolateBackendApi,
  mockProductDetails,
  mockProductList,
  networkTestProduct,
  productApiPage,
  waitForProductListResponse,
  apiOrigin,
} from '../test-utils/network-mocking';

test.describe('Network resilience (NET)', () => {
  test.describe.configure({ retries: 0 });

  test('NET-001 keeps products pending until a delayed response completes', async ({ page }) => {
    await isolateBackendApi(page);

    let markRequestStarted!: () => void;
    const requestStarted = new Promise<void>(resolve => {
      markRequestStarted = resolve;
    });

    await page.route(
      (url: URL) => isProductListUrl(url),
      async route => {
        markRequestStarted();
        await new Promise(resolve => setTimeout(resolve, 5_000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(productApiPage([networkTestProduct])),
        });
      },
    );

    const productsPage = new ProductsPage(page);
    const responsePromise = waitForProductListResponse(page);
    await productsPage.goto();
    await requestStarted;

    await expect(productsPage.productNames).toHaveCount(0);
    await expect(page.locator('[data-test="sort"]')).toBeEnabled();
    await expect(page.locator('.card.skeleton')).not.toHaveCount(0);

    const response = await responsePromise;
    expect(response.status()).toBe(200);
    await expect(productsPage.productNames).toHaveText([networkTestProduct.name]);
    await expect(page.locator('.card.skeleton')).toHaveCount(0);
  });

  test('NET-002 recovers after a failed product request when the user reloads', async ({ page }) => {
    await isolateBackendApi(page);
    let attempt = 0;
    await page.route((url: URL) => isProductListUrl(url), async route => {
      attempt += 1;
      if (attempt === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Simulated server error' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(productApiPage([networkTestProduct])),
      });
    });

    const productsPage = new ProductsPage(page);
    let responsePromise = waitForProductListResponse(page);
    await productsPage.goto();
    expect((await responsePromise).status()).toBe(500);
    await expect(productsPage.productNames).toHaveCount(0);
    await expect(page.locator('[data-test="sort"]')).toBeEnabled();

    responsePromise = waitForProductListResponse(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    expect((await responsePromise).status()).toBe(200);
    await expect(productsPage.productNames).toHaveText([networkTestProduct.name]);
  });

  test('NET-003 keeps product details accessible when a product image fails', async ({ page }) => {
    await isolateBackendApi(page);
    await mockProductList(page, { body: productApiPage([networkTestProduct]) });
    const imageUrl = '**/assets/img/products/pliers01.avif';
    await page.route(imageUrl, route => route.fulfill({ status: 404, body: 'Not found' }));

    const productsPage = new ProductsPage(page);
    const imageResponsePromise = page.waitForResponse(response => response.url().endsWith('/assets/img/products/pliers01.avif'));
    const productResponsePromise = waitForProductListResponse(page);
    await productsPage.goto();

    expect((await productResponsePromise).status()).toBe(200);
    expect((await imageResponsePromise).status()).toBe(404);
    await expect(productsPage.productNames).toHaveText([networkTestProduct.name]);
    await expect(page.locator('[data-test="product-price"]')).toHaveText('$12.50');
    const productImage = page.locator('a[href^="/product/"]:has([data-test="product-name"]) img').first();
    await expect(productImage).toHaveJSProperty('naturalWidth', 0);
    await expect(productImage).toHaveAttribute('alt', networkTestProduct.name);
  });

  test('NET-004 reports a failed cart API request without updating the cart', async ({ page }) => {
    await isolateBackendApi(page);
    await mockProductList(page, { body: productApiPage([networkTestProduct]) });
    await mockProductDetails(page, networkTestProduct);

    const isCartCreateRequest = (url: URL, method: string) =>
      url.origin === apiOrigin && url.pathname === '/carts' && method === 'POST';
    await page.route(
      (url: URL) => isCartCreateRequest(url, 'POST'),
      route =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Simulated server error' }),
        }),
    );

    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);

    await productsPage.goto();
    await expect(productsPage.productNames).toHaveText([networkTestProduct.name]);
    await productsPage.openProduct(0);
    await expect(productDetailsPage.productName).toHaveText(networkTestProduct.name);

    const cartResponsePromise = page.waitForResponse(response =>
      isCartCreateRequest(new URL(response.url()), response.request().method()),
    );
    await productDetailsPage.addToCart();
    const cartResponse = await cartResponsePromise;
    expect(cartResponse.status()).toBe(500);
    await expect(networkErrorIndicator(page).first()).toBeVisible({ timeout: 2_000 });
    await expect(
      page.getByRole('alert').filter({ hasText: 'Product added to shopping cart.' }),
    ).toHaveCount(0);

    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await expect(cartPage.productTitles).toHaveCount(0);
    await test.info().attach('cart-api-response', {
      body: JSON.stringify(
        { method: cartResponse.request().method(), url: cartResponse.url(), status: cartResponse.status() },
        null,
        2,
      ),
      contentType: 'application/json',
    });
  });

});

function networkErrorIndicator(page: Page) {
  return page.locator(
    '[role="alert"]:visible, [role="status"]:visible, [data-test*="error" i]:visible, .alert:visible, [class*="toast" i]:visible',
  );
}
