import { expect, test } from '@playwright/test';
import { CartPage } from './pages/cart.page';
import { CheckoutPage } from './pages/checkout.page';
import { LoginPage } from './pages/login.page';
import { OrderConfirmationPage } from './pages/order-confirmation.page';
import { ProductDetailsPage } from './pages/product-details.page';
import { ProductsPage } from './pages/products.page';
import { purchaseTestData } from './test-data/purchase';

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

test.describe.configure({ retries: 0 });

function priceInCents(displayedPrice: string) {
  const amount = displayedPrice.match(/\d+(?:\.\d{1,2})?/);

  if (amount === null) {
    throw new Error(`Could not parse displayed price "${displayedPrice}".`);
  }

  return Math.round(Number(amount[0]) * 100);
}

test('should complete a purchase successfully as an authenticated customer', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  if (testInfo.project.name !== 'chromium') {
    test.skip(true, 'Purchase flow uses a shared demo customer; run it once in Chromium.');
    return;
  }
  if (!username || !password) {
    test.skip(true, 'Set E2E_USERNAME and E2E_PASSWORD to a valid demo customer account.');
    return;
  }

  const loginPage = new LoginPage(page);
  const productsPage = new ProductsPage(page);
  const productDetailsPage = new ProductDetailsPage(page);
  const cartPage = new CartPage(page);
  const checkoutPage = new CheckoutPage(page);
  const orderConfirmationPage = new OrderConfirmationPage(page);

  await test.step('Log in as a customer', async () => {
    await loginPage.goto();
    await loginPage.login(username, password);
    await expect(loginPage.accountHeading, 'The account page confirms successful login.').toBeVisible();
    await expect(loginPage.authenticatedUser, 'The authenticated customer is displayed in navigation.').toBeVisible();
  });

  let selectedProduct: { name: string; price: string; index: number } | undefined;

  await test.step('Search for and open an available product', async () => {
    await productsPage.goto();
    await productsPage.searchFor(purchaseTestData.searchQuery);
    await expect(productsPage.searchHeading).toContainText(purchaseTestData.searchQuery);
    await expect(productsPage.searchResultSummary).toContainText(purchaseTestData.searchQuery);
    await expect.poll(async () => {
      const [resultCount, productNames] = await Promise.all([
        productsPage.getSearchResultCount(),
        productsPage.getProductNames(),
      ]);
      return (
        productNames.length === resultCount &&
        productNames.length > 0 &&
        productNames.every(name =>
          name.toLocaleLowerCase().includes(purchaseTestData.searchQuery.toLocaleLowerCase()),
        )
      );
    }, { timeout: 15_000 }).toBe(true);

    const searchResults = await productsPage.getProductSummaries();
    expect(searchResults.length, 'The search returns products to choose from.').toBeGreaterThan(0);
    expect(
      searchResults.every(product =>
        product.name.toLocaleLowerCase().includes(purchaseTestData.searchQuery.toLocaleLowerCase()),
      ),
      'Every displayed result matches the product search.',
    ).toBe(true);

    selectedProduct = searchResults.find(
      product =>
        !product.outOfStock &&
        product.name.toLocaleLowerCase().includes(purchaseTestData.searchQuery.toLocaleLowerCase()),
    );
    expect(selectedProduct, 'At least one matching search result is in stock.').toBeDefined();
    if (selectedProduct === undefined) {
      throw new Error(`No in-stock product matched "${purchaseTestData.searchQuery}".`);
    }

    await productsPage.openProduct(selectedProduct.index);
    await expect(productDetailsPage.productName).toHaveText(selectedProduct.name);
    await expect(productDetailsPage.unitPrice).toBeVisible();
    expect(priceInCents(await productDetailsPage.unitPrice.innerText())).toBe(priceInCents(selectedProduct.price));
  });

  if (selectedProduct === undefined) {
    throw new Error('The product search step did not select a product.');
  }

  await test.step('Add the selected product to the cart', async () => {
    await productDetailsPage.addToCart();
    await expect(productDetailsPage.addedToCartMessage).toHaveText('Product added to shopping cart.');
  });

  await test.step('Verify cart quantity and pricing', async () => {
    await cartPage.open();
    await expect(cartPage.productTitles).toHaveCount(1);
    await expect(cartPage.productTitles).toHaveText([selectedProduct.name]);
    await expect(cartPage.productQuantity).toHaveValue('1');

    const expectedPrice = priceInCents(selectedProduct.price);
    const expectedDisplayedPrice = `$${(expectedPrice / 100).toFixed(2)}`;
    await expect(cartPage.productPrice).toHaveText(expectedDisplayedPrice);
    await expect(cartPage.linePrice).toHaveText(expectedDisplayedPrice);
    await expect(cartPage.total).toHaveText(expectedDisplayedPrice);
    expect(priceInCents(await cartPage.total.innerText())).toBe(expectedPrice);
  });

  await test.step('Complete billing and payment', async () => {
    await checkoutPage.proceedToSignIn();
    await expect(checkoutPage.signedInNotice).toBeVisible();
    await checkoutPage.proceedToBillingAddress();
    await expect(checkoutPage.billingHeading).toBeVisible();

    await checkoutPage.fillBillingAddress(purchaseTestData.billingAddress);
    await expect(checkoutPage.country).toHaveValue(purchaseTestData.billingAddress.country);
    await expect(checkoutPage.postalCode).toHaveValue(purchaseTestData.billingAddress.postalCode);
    await expect(checkoutPage.houseNumber).toHaveValue(purchaseTestData.billingAddress.houseNumber);
    await expect(checkoutPage.street).toHaveValue(purchaseTestData.billingAddress.street);
    await expect(checkoutPage.city).toHaveValue(purchaseTestData.billingAddress.city);
    await expect(checkoutPage.state).toHaveValue(purchaseTestData.billingAddress.state);

    await checkoutPage.proceedToPayment();
    await checkoutPage.selectPaymentMethod(purchaseTestData.paymentMethod);
    await expect(checkoutPage.checkPaymentButton).toBeEnabled();
    await checkoutPage.checkPayment();
    await expect(checkoutPage.confirmOrderButton).toBeVisible();
    await checkoutPage.confirmOrder();
  });

  await test.step('Verify order confirmation and invoice reference', async () => {
    await expect(orderConfirmationPage.confirmationMessage).toContainText('Thanks for your order!');
    const invoiceNumber = await orderConfirmationPage.getInvoiceNumber();
    expect(invoiceNumber, 'The successful order has an invoice reference.').toMatch(/^INV-\d+$/);
    test.info().annotations.push({ type: 'invoice-number', description: invoiceNumber });
  });
});
