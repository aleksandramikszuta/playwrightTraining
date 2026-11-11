import { expect, test } from '@playwright/test';
import { CartPage } from './pages/cart.page';
import { ProductDetailsPage } from './pages/product-details.page';
import { ProductsPage, type ProductSummary } from './pages/products.page';
import {
  calculateCartTotalInCents,
  calculateSubtotalInCents,
  moneyInCents,
} from './test-utils/cart-calculations';

interface AddedProduct {
  name: string;
  unitPriceInCents: number;
}

async function addProducts(
  productsPage: ProductsPage,
  productDetailsPage: ProductDetailsPage,
  count: number,
): Promise<AddedProduct[]> {
  await productsPage.goto();
  await expect(productsPage.productNames.first()).toBeVisible({ timeout: 15_000 });
  const availableProducts = (await productsPage.getProductSummaries()).filter(
    (product: ProductSummary) => !product.outOfStock,
  );
  expect(availableProducts.length, 'The listing contains enough in-stock products.').toBeGreaterThanOrEqual(count);

  const addedProducts: AddedProduct[] = [];
  for (const product of availableProducts.slice(0, count)) {
    if (addedProducts.length > 0) {
      await productsPage.goto();
      await expect(productsPage.productNames.first()).toBeVisible({ timeout: 15_000 });
    }

    await productsPage.openProductByName(product.name);
    await expect(productDetailsPage.productName).toHaveText(product.name);
    await expect(productDetailsPage.unitPrice).toBeVisible();
    const unitPriceInCents = moneyInCents(await productDetailsPage.unitPrice.innerText());

    await productDetailsPage.addToCart();
    await expect(productDetailsPage.addedToCartMessage).toHaveText('Product added to shopping cart.');
    addedProducts.push({ name: product.name, unitPriceInCents });
  }

  return addedProducts;
}

function calculationItems(products: AddedProduct[], quantities: number[]) {
  return products.map((product, index) => ({
    unitPriceInCents: product.unitPriceInCents,
    quantity: quantities[index],
  }));
}

async function expectedSubtotalInCents(
  cartPage: CartPage,
  products: AddedProduct[],
  quantities: number[],
) {
  const cartItems = await cartPage.getCartItems();
  return calculateSubtotalInCents(
    products.map((product, index) => {
      const cartItem = cartItems.find(item => item.name === product.name);
      if (cartItem === undefined) {
        throw new Error(`${product.name} was not found in the cart while calculating its subtotal.`);
      }

      return {
        unitPriceInCents:
          cartItem.discountedUnitPrice === null
            ? product.unitPriceInCents
            : moneyInCents(cartItem.discountedUnitPrice),
        quantity: quantities[index],
      };
    }),
  );
}

async function expectCartLines(
  cartPage: CartPage,
  products: AddedProduct[],
  quantities: number[],
) {
  await expect(cartPage.productTitles).toHaveCount(products.length);
  for (const [index, product] of products.entries()) {
    await expect(cartPage.getProductQuantityInput(product.name)).toHaveValue(String(quantities[index]));
    await expect(cartPage.getProductLinePrice(product.name)).toHaveText(
      new RegExp(`\\$${((product.unitPriceInCents * quantities[index]) / 100).toFixed(2)}`),
    );
  }

  const cartItems = await cartPage.getCartItems();

  for (const [index, product] of products.entries()) {
    const cartItem = cartItems.find(item => item.name === product.name);
    expect(cartItem, `${product.name} is present in the cart.`).toBeDefined();
    if (cartItem === undefined) {
      throw new Error(`${product.name} was not found in the cart.`);
    }

    expect(cartItem.quantity).toBe(quantities[index]);
    expect(moneyInCents(cartItem.unitPrice)).toBe(product.unitPriceInCents);
    expect(moneyInCents(cartItem.linePrice)).toBe(product.unitPriceInCents * quantities[index]);
  }
}

async function expectSubtotalOrLineSum(
  cartPage: CartPage,
  expectedSubtotalInCents: number,
  expectedLineSumInCents: number,
) {
  const displayedSubtotal = await cartPage.getSubtotal();
  if (displayedSubtotal !== null) {
    expect(moneyInCents(displayedSubtotal)).toBe(expectedSubtotalInCents);
  } else {
    const displayedLineSum = (await cartPage.getCartItems()).reduce(
      (sum, item) => sum + moneyInCents(item.linePrice),
      0,
    );
    expect(displayedLineSum).toBe(expectedLineSumInCents);
  }
}

async function expectSubtotal(cartPage: CartPage, products: AddedProduct[], quantities: number[]) {
  const expectedSubtotal = await expectedSubtotalInCents(cartPage, products, quantities);
  const expectedLineSum = calculateSubtotalInCents(calculationItems(products, quantities));
  await expectSubtotalOrLineSum(cartPage, expectedSubtotal, expectedLineSum);
}

async function calculateCartExpectations(cartPage: CartPage) {
  const cartItems = await cartPage.getCartItems();
  const pricedItems = cartItems.map(item => ({
    unitPriceInCents: moneyInCents(item.discountedUnitPrice ?? item.unitPrice),
    quantity: item.quantity,
  }));
  const lineItems = cartItems.map(item => ({
    unitPriceInCents: moneyInCents(item.unitPrice),
    quantity: item.quantity,
  }));
  const delivery = await cartPage.getDeliveryCost();
  const tax = await cartPage.getTax();
  const cartDiscount = await cartPage.getCartDiscount();
  const ecoDiscount = await cartPage.getEcoDiscount();

  return {
    subtotalInCents: calculateSubtotalInCents(pricedItems),
    lineSumInCents: calculateSubtotalInCents(lineItems),
    totalInCents: calculateCartTotalInCents({
      items: pricedItems,
      deliveryInCents: delivery === null ? 0 : moneyInCents(delivery),
      taxInCents: tax === null ? 0 : moneyInCents(tax),
      discountsInCents:
        Math.abs(cartDiscount === null ? 0 : moneyInCents(cartDiscount)) +
        Math.abs(ecoDiscount === null ? 0 : moneyInCents(ecoDiscount)),
    }),
  };
}

async function changeAndVerifyQuantity(
  cartPage: CartPage,
  product: AddedProduct,
  quantity: number,
  direction: 'increase' | 'decrease',
) {
  if (direction === 'increase') {
    await cartPage.increaseQuantity(product.name);
  } else {
    await cartPage.decreaseQuantity(product.name);
  }

  await expect(cartPage.getProductQuantityInput(product.name)).toHaveValue(String(quantity));
  await expect(cartPage.getProductLinePrice(product.name)).toHaveText(
    new RegExp(`\\$${((product.unitPriceInCents * quantity) / 100).toFixed(2)}`),
  );
}

test.describe('Cart calculations', () => {
  test('CART-001 verifies the subtotal for multiple products', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);

    await test.step('Add two different products and record their prices', async () => {
      const products = await addProducts(productsPage, productDetailsPage, 2);
      await cartPage.open();
      await expectCartLines(cartPage, products, [1, 1]);
      await expectSubtotal(cartPage, products, [1, 1]);
    });
  });

  test('CART-002 verifies subtotal recalculation when quantity increases', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);
    const [product] = await addProducts(productsPage, productDetailsPage, 1);

    await cartPage.open();
    await test.step('Increase quantity to two and verify the calculation', async () => {
      await changeAndVerifyQuantity(cartPage, product, 2, 'increase');
      await expectSubtotal(cartPage, [product], [2]);
    });
    await test.step('Increase quantity to three and verify the recalculation', async () => {
      await changeAndVerifyQuantity(cartPage, product, 3, 'increase');
      await expectSubtotal(cartPage, [product], [3]);
    });
  });

  test('CART-003 verifies calculations for different quantities of three products', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);
    const products = await addProducts(productsPage, productDetailsPage, 3);

    await cartPage.open();
    await test.step('Set distinct quantities for all three products', async () => {
      await cartPage.setQuantity(products[0].name, 2);
      await cartPage.setQuantity(products[1].name, 3);
      await expectCartLines(cartPage, products, [2, 3, 1]);
      await expectSubtotal(cartPage, products, [2, 3, 1]);
    });
  });

  test('CART-004 verifies subtotal recalculation when quantity decreases', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);
    const [product] = await addProducts(productsPage, productDetailsPage, 1);

    await cartPage.open();
    await test.step('Increase quantity to three', async () => {
      await changeAndVerifyQuantity(cartPage, product, 2, 'increase');
      await changeAndVerifyQuantity(cartPage, product, 3, 'increase');
      await expectSubtotal(cartPage, [product], [3]);
    });
    await test.step('Decrease quantity to two', async () => {
      await changeAndVerifyQuantity(cartPage, product, 2, 'decrease');
      await expectSubtotal(cartPage, [product], [2]);
    });
    await test.step('Decrease quantity to one', async () => {
      await changeAndVerifyQuantity(cartPage, product, 1, 'decrease');
      await expectSubtotal(cartPage, [product], [1]);
    });
  });

  test('CART-005 verifies removing a product recalculates the subtotal', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);
    const products = await addProducts(productsPage, productDetailsPage, 2);

    await cartPage.open();
    await test.step('Remove the first product and verify the remaining cart', async () => {
      await expect(cartPage.productTitles).toHaveCount(2);
      await cartPage.removeProduct(products[0].name);
      await expect(cartPage.productTitles).toHaveCount(1);
      await expect(cartPage.productTitles).toHaveText([products[1].name]);
      await expectSubtotal(cartPage, [products[1]], [1]);
      await expect(cartPage.linePrice).toHaveText(
        new RegExp(`\\$${(products[1].unitPriceInCents / 100).toFixed(2)}`),
      );
    });
  });

  test('CART-006 verifies the total includes the applicable delivery cost and discounts', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);
    const products = await addProducts(productsPage, productDetailsPage, 2);

    await cartPage.open();
    await test.step('Add multiple products with different quantities', async () => {
      await cartPage.setQuantity(products[0].name, 2);
      await cartPage.setQuantity(products[1].name, 3);
      await expectCartLines(cartPage, products, [2, 3]);
    });

    await test.step('Calculate and verify subtotal, discounts, delivery and total', async () => {
      const expected = await calculateCartExpectations(cartPage);
      await expectSubtotalOrLineSum(cartPage, expected.subtotalInCents, expected.lineSumInCents);
      expect(moneyInCents(await cartPage.getTotal())).toBe(expected.totalInCents);
    });
  });

  test('CART-007 preserves cart contents and calculations after a refresh', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);
    const products = await addProducts(productsPage, productDetailsPage, 2);

    await cartPage.open();
    await test.step('Configure quantities before refreshing', async () => {
      await cartPage.setQuantity(products[0].name, 2);
      await cartPage.setQuantity(products[1].name, 3);
      await expectCartLines(cartPage, products, [2, 3]);
    });
    const expected = await calculateCartExpectations(cartPage);

    await test.step('Refresh and verify the cart state and subtotal persist', async () => {
      await page.reload();
      await expectCartLines(cartPage, products, [2, 3]);
      await expectSubtotalOrLineSum(cartPage, expected.subtotalInCents, expected.lineSumInCents);
      expect(moneyInCents(await cartPage.getTotal())).toBe(expected.totalInCents);
    });
  });

  test('CART-008 shows an empty cart after all products are removed', async ({ page }) => {
    const productsPage = new ProductsPage(page);
    const productDetailsPage = new ProductDetailsPage(page);
    const cartPage = new CartPage(page);
    const products = await addProducts(productsPage, productDetailsPage, 2);

    await cartPage.open();
    await test.step('Remove all products and verify the empty cart state', async () => {
      await cartPage.removeProduct(products[0].name);
      await cartPage.removeProduct(products[1].name);

      await expect(cartPage.productTitles).toHaveCount(0);
      await expect(cartPage.emptyCartMessage).toBeVisible();
      expect(await cartPage.getEmptyCartMessage()).not.toBe('');
      await expect(cartPage.subtotal).toHaveCount(0);
      await expect(cartPage.total).toHaveCount(0);
    });
  });
});
