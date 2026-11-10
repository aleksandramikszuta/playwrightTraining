import type { Locator, Page } from '@playwright/test';

export class OrderConfirmationPage {
  readonly confirmationMessage: Locator;

  constructor(page: Page) {
    this.confirmationMessage = page.getByText(/Thanks for your order!/i);
  }

  async getInvoiceNumber() {
    const message = await this.confirmationMessage.innerText();
    const invoiceNumber = message.match(/invoice number is (INV-\d+)/i)?.[1];

    if (invoiceNumber === undefined) {
      throw new Error(`Could not read the invoice number from "${message}".`);
    }

    return invoiceNumber;
  }
}
