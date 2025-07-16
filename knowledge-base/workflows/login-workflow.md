---
type: workflow
category: authentication
---

# Login Workflow

## Standard Login Process
1. Navigate to the login page
2. Fill in email/username field
3. Fill in password field
4. Click login/submit button
5. Wait for navigation
6. Handle product selector if prompted
7. Verify successful login

## Playwright Implementation
```typescript
import { test, expect } from '@playwright/test';

test('Login to vProMedia', async ({ page }) => {
  // Navigate to login page
  await page.goto(process.env.BASE_URL + '/login');

  // Fill credentials
  await page.fill('input[name="username"]', process.env.TEST_EMAIL!);
  await page.fill('input[name="password"]', process.env.TEST_PASSWORD!);

  // Submit login
  await page.click('button[type="submit"]');
  await page.waitForNavigation();

  // Handle product selector if present
  if (await page.isVisible('#vpro-media-product-selector-btn')) {
    await page.click('#vpro-media-product-selector-btn');
  }

  // Verify successful login
  await expect(page.locator('.vcreative-icon')).toBeVisible();
});
```

## Test Users Available
- Demo Production Director: `imail-test+DemoProdDirector@vcreativeinc.com`
- Cypress Test User: `imail-test+CypressTestUser@vcreativeinc.com`
- Demo Traffic Director: `imail-test+DemoTrafficDirector@vcreativeinc.com`

## Error Handling
- Invalid credentials should show error message
- Missing fields should prevent submission
- Network errors should be handled gracefully
