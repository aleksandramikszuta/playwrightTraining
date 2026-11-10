import type { BillingAddress } from '../pages/checkout.page';

export const purchaseTestData = {
  searchQuery: 'Pliers',
  billingAddress: {
    country: 'US',
    postalCode: '10001',
    houseNumber: '42',
    street: 'Main Street',
    city: 'New York',
    state: 'New York',
  } satisfies BillingAddress,
  paymentMethod: 'cash-on-delivery',
};
