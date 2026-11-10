import type { Locator, Page } from '@playwright/test';

export interface BillingAddress {
  country: string;
  postalCode: string;
  houseNumber: string;
  street: string;
  city: string;
  state: string;
}

export class CheckoutPage {
  readonly signedInNotice: Locator;
  readonly billingHeading: Locator;
  readonly paymentHeading: Locator;
  readonly country: Locator;
  readonly postalCode: Locator;
  readonly houseNumber: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly paymentMethod: Locator;
  readonly checkPaymentButton: Locator;
  readonly confirmOrderButton: Locator;

  constructor(private readonly page: Page) {
    this.signedInNotice = page.getByText(/you are already logged in/i);
    this.billingHeading = page.getByRole('heading', { name: 'Billing Address' });
    this.paymentHeading = page.getByRole('heading', { name: 'Payment' });
    this.country = page.getByLabel('Country');
    this.postalCode = page.getByLabel('Postal code');
    this.houseNumber = page.getByLabel('House number');
    this.street = page.getByLabel('Street');
    this.city = page.getByLabel('City');
    this.state = page.getByLabel('State');
    this.paymentMethod = page.getByLabel('Payment Method');
    this.checkPaymentButton = page.getByRole('button', { name: 'Check payment' });
    this.confirmOrderButton = page.getByRole('button', { name: 'Confirm' });
  }

  async proceedToSignIn() {
    await this.page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await this.signedInNotice.waitFor({ state: 'visible' });
  }

  async proceedToBillingAddress() {
    await this.page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await this.billingHeading.waitFor({ state: 'visible' });
  }

  async fillBillingAddress(address: BillingAddress) {
    await this.country.selectOption(address.country);
    await this.postalCode.fill(address.postalCode);
    await this.houseNumber.fill(address.houseNumber);
    await this.street.fill(address.street);
    await this.city.fill(address.city);
    await this.state.fill(address.state);
  }

  async proceedToPayment() {
    await this.page.getByRole('button', { name: 'Proceed to checkout' }).click();
    await this.paymentHeading.waitFor({ state: 'visible' });
  }

  async selectPaymentMethod(method: string) {
    await this.paymentMethod.selectOption(method);
  }

  async checkPayment() {
    await this.checkPaymentButton.click();
  }

  async confirmOrder() {
    await this.confirmOrderButton.click();
  }
}
