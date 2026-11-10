import type { Locator, Page } from '@playwright/test';

export class LoginPage {
  readonly authenticatedUser: Locator;
  readonly accountHeading: Locator;

  constructor(private readonly page: Page) {
    this.authenticatedUser = page.locator('[data-test="nav-menu"]');
    this.accountHeading = page.getByRole('heading', { name: 'My account' });
  }

  async goto() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.page.getByRole('link', { name: 'Sign in' }).click();
  }

  async login(username: string, password: string) {
    await this.page.getByLabel('Email address *').fill(username);
    await this.page.getByLabel('Password *').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
    await this.accountHeading.waitFor({ state: 'visible' });
  }
}
