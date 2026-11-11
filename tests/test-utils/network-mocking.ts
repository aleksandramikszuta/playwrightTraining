import type { Page, Route } from '@playwright/test';

export const apiOrigin = 'https://api.practicesoftwaretesting.com';

export interface ProductApiProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  is_location_offer: boolean;
  is_rental: boolean;
  co2_rating: string;
  in_stock: boolean;
  is_eco_friendly: boolean;
  product_image: {
    id: string;
    by_name: string;
    by_url: string;
    source_name: string;
    source_url: string;
    file_name: string;
    title: string;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  };
  brand: {
    id: string;
    name: string;
  };
}

export interface ProductApiPage {
  current_page: number;
  data: ProductApiProduct[];
  from: number | null;
  last_page: number;
  per_page: number;
  to: number | null;
  total: number;
}

export const networkTestProduct: ProductApiProduct = {
  id: '01M75B43D8474YCPK899W84BG2',
  name: 'Network Test Pliers',
  description: 'A deterministic product used by network resilience tests.',
  price: 12.5,
  is_location_offer: false,
  is_rental: false,
  co2_rating: 'D',
  in_stock: true,
  is_eco_friendly: false,
  product_image: {
    id: '01M75B43C627YCTCBPMY6X48VA',
    by_name: 'Test fixture',
    by_url: '',
    source_name: 'Test fixture',
    source_url: '',
    file_name: 'pliers01.avif',
    title: 'Network Test Pliers',
  },
  category: {
    id: '01M75B43B9RXCMCAVG08T76KR7',
    name: 'Pliers',
    slug: 'pliers',
  },
  brand: {
    id: '01M75B42X5J4AY1CD4KTN3Z6BA',
    name: 'Network Test Brand',
  },
};

export function productApiPage(products: ProductApiProduct[] = []): ProductApiPage {
  return {
    current_page: 1,
    data: products,
    from: products.length === 0 ? null : 1,
    last_page: 1,
    per_page: 9,
    to: products.length === 0 ? null : products.length,
    total: products.length,
  };
}

export async function isolateBackendApi(page: Page) {
  await page.route(`${apiOrigin}/**`, async (route: Route) => route.abort());

  const supportingResponses = new Map([
    [
      '/users/me',
      { status: 401, body: { message: 'Unauthorized' } },
    ],
    [
      '/brands',
      {
        status: 200,
        body: [
          {
            id: '01M75B42X5J4AY1CD4KTN3Z6BA',
            name: 'Network Test Brand',
            slug: 'network-test-brand',
          },
        ],
      },
    ],
    [
      '/categories/tree',
      {
        status: 200,
        body: [
          {
            id: '01M75B439WZXJ0YZHTJTXC2D7D',
            name: 'Hand Tools',
            slug: 'hand-tools',
            parent_id: null,
            sub_categories: [
              {
                id: '01M75B43B9RXCMCAVG08T76KR7',
                name: 'Pliers',
                slug: 'pliers',
                parent_id: '01M75B439WZXJ0YZHTJTXC2D7D',
                sub_categories: [],
              },
            ],
          },
        ],
      },
    ],
    [
      '/product-specs/names',
      { status: 200, body: [{ name: 'Adjustable', values: ['Yes'], unit: null }] },
    ],
  ]);

  await page.route(
    (url: URL) => url.origin === apiOrigin && supportingResponses.has(url.pathname),
    route => {
      const response = supportingResponses.get(new URL(route.request().url()).pathname);
      if (response === undefined) {
        throw new Error(`Missing supporting API response for ${route.request().url()}`);
      }

      return route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      });
    },
  );
}

export function isProductListUrl(url: URL) {
  return url.origin === apiOrigin && url.pathname === '/products';
}

export function isProductDetailUrl(url: URL, productId: string) {
  return url.origin === apiOrigin && url.pathname === `/products/${productId}`;
}

export async function mockProductList(
  page: Page,
  response: { status?: number; body: ProductApiPage },
) {
  await page.route(
    (url: URL) => isProductListUrl(url),
    (route: Route) =>
      route.fulfill({
        status: response.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      }),
  );
}

export async function mockProductDetails(page: Page, product: ProductApiProduct) {
  await page.route(
    (url: URL) => isProductDetailUrl(url, product.id),
    (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(product),
      }),
  );
  await page.route(
    (url: URL) =>
      url.origin === apiOrigin && url.pathname === `/products/${product.id}/related`,
    route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      }),
  );
}

export function waitForProductListResponse(page: Page) {
  return page.waitForResponse(response => isProductListUrl(new URL(response.url())));
}
