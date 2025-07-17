---
type: pattern
category: best-practices
---

# Playwright Best Practices for vProMedia

## Waiting Strategies
```typescript
// Good - Use expect with proper timeout
await expect(page.locator('.loading-spinner')).toBeVisible();
await expect(page.locator('.loading-spinner')).toBeHidden();

// Better - Wait for network to be idle after navigation
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');

// Best - Wait for specific elements that indicate page is ready
await page.goto('/quick-order');
await expect(page.locator("ul[root='true'] span")).toBeVisible();
```

## Form Interactions
```typescript
// Fill form fields with proper selectors
await page.fill("input[placeholder='Client or Advertiser']", clientName);
await page.fill("input[name='card_spot_title']", spotTitle);

// Handle dropdowns properly
await page.click("text=Select an Adtype");
await page.click("li[aria-label='Radio Commercial'] span");

// Verify form submission
const missingFields = await page.locator('#missing-fields-tool-tip-icon').isVisible();
if (!missingFields) {
  await page.click("button#submit-all-qo-orders");
}
```

## Search and Navigation
```typescript
// Proper search implementation
await page.fill('.search-input', searchTerm);
await page.click('button[id="do-search-btn"] span');
await page.waitForTimeout(5000); // Allow search results to load

// Navigate with verification
await page.click('.po-text-status-link');
await expect(page.locator('ul#pr_id_9_list')).toBeVisible();
```

## File Upload Handling
```typescript
// Handle file uploads
await page.setInputFiles("input[type='file']", filePath);

// Verify file attachment
await expect(page.locator('.file-attachment')).toContainText(fileName);
```

## Error Handling Patterns
```typescript
// Check for validation errors before proceeding
const hasErrors = await page.locator('.error-message').isVisible();
if (hasErrors) {
  const errorText = await page.locator('.error-message').textContent();
  throw new Error(`Validation error: ${errorText}`);
}

// Handle toast notifications
const toast = page.locator('.toast-message');
if (await toast.isVisible()) {
  const message = await toast.textContent();
  console.log(`Toast message: ${message}`);
}
```

## POC Assignment Patterns
```typescript
// Robust POC assignment
const pocCell = page.locator('td.poc-column').filter({ hasText: jobType });
await pocCell.locator('.poc-job-title').click();
await page.fill('.search-field', assigneeName);
await page.click('.ui-dropdown-item');

// Verify assignment
await expect(pocCell.locator('div[appuser].job-completed')).toHaveText(expectedName);
```

## Date Picker Interactions
```typescript
// Handle date pickers consistently
await page.click("p-calendar[name='card_start_date']");
await page.click("td.ui-datepicker-today a");

// For dynamic form UUIDs
const formUUID = await page.locator('#form-id-hidden-div').textContent();
await page.click(`#date-picker-element-${formUUID}-start_date`);
```

## Retry Patterns
```typescript
// Implement retry for flaky operations
async function retryOperation(operation: () => Promise<void>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await operation();
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await page.waitForTimeout(1000);
    }
  }
}

// Usage
await retryOperation(async () => {
  await page.click('.sometimes-flaky-button');
  await expect(page.locator('.success-indicator')).toBeVisible();
});
```

## Environment Configuration
```typescript
// Use environment variables for configuration
const baseUrl = process.env.BASE_URL || 'https://two-test.vcreative.net';
const testUser = process.env.TEST_EMAIL || 'imail-test+CypressTestUser@vcreativeinc.com';
const testPassword = process.env.TEST_PASSWORD || 'OneVCTeam2023!';
```

## Page Object Pattern
```typescript
// Create reusable page objects
class QuickOrderPage {
  constructor(private page: Page) {}

  async createSpot(spotData: SpotData) {
    await this.page.click("ul[root='true'] span");
    await this.selectAdType(spotData.adType);
    await this.fillSpotDetails(spotData);
    await this.submitOrder();
  }

  private async selectAdType(adType: string) {
    await this.page.click("text=Select an Adtype");
    await this.page.click(`li[aria-label='${adType}'] span`);
  }

  private async fillSpotDetails(data: SpotData) {
    await this.page.fill("input[name='card_spot_title']", data.title);
    await this.page.fill("input[name='card_spot_length']", data.length);
    // ... more field filling
  }

  private async submitOrder() {
    const hasErrors = await this.page.locator('#missing-fields-tool-tip-icon').isVisible();
    if (!hasErrors) {
      await this.page.click("button#submit-all-qo-orders");
    }
  }
}
```

## Login Flow (QA Environment)
```typescript
// Best Practice: Use getByRole for login fields and buttons
// Use test.step for clear test structure
import { expect, test } from '@playwright/test';

test('Successful login', async ({ page }) => {
    await test.step('Navigate to the login page', async () => {
        await page.goto('https://qa.vcreative.net/login');
    });

    await test.step('Enter valid credentials', async () => {
        await page.getByRole('textbox', { name: /email/i }).fill(email);
        await page.getByRole('textbox', { name: /password/i }).fill(password);
    });

    await test.step('Submit the login form', async () => {
        await page.getByRole('button', { name: /login/i }).click();
    });

    await test.step('Wait for home page and click media selector', async () => {
        await Promise.all([
            page.waitForURL('**/vpro/home', { timeout: 240_000 }),
            page.locator('#vpro-media-product-selector-btn').click({ timeout: 240_000 })
        ]);
    });
});

// Invalid login example

test('Invalid login shows error message', async ({ page }) => {
    await test.step('Navigate to the login page', async () => {
        await page.goto('/login');
    });

    await test.step('Enter invalid credentials', async () => {
        await page.getByRole('textbox', { name: /email/i }).fill('wronguser@vcreativeinc.com');
        await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword');
    });

    await test.step('Submit the login form', async () => {
        await page.getByRole('button', { name: /login/i }).click();
    });

    await test.step('Verify error message appears', async () => {
        const errorMessage = page.locator('.ui-toast-message-content');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toHaveText(/invalid user/i);
    });
});

test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        await page.screenshot({ path: `screenshots/${testInfo.title}.png`, fullPage: true });
    }
});

**Note:**
- Always use `getByRole` for login fields and buttons for robust selectors.
- Use `test.step` for clear, maintainable test structure.
- Take screenshots on failure for easier debugging.
```

## Playwright Test Structure (Best Practice)

**Keywords:** playwright, test.step, invalid login, error message, screenshot, afterEach, robust selectors, login, authentication, credentials, failure handling, timeout, test.setTimeout

```typescript
import { expect, test } from '@playwright/test';

test.setTimeout(240_000); // Best practice: set a large timeout for all tests

test('Invalid login shows error message', async ({ page }) => {
    await test.step('Navigate to the login page', async () => {
        await page.goto('/');
    });

    await test.step('Enter invalid credentials', async () => {
        await page.fill('input[name="username"]', 'wronguser@vcreativeinc.com');
        await page.fill('input[name="password"]', 'wrongpassword');
    });

    await test.step('Submit the login form', async () => {
        await page.click('button:text("Login")');
    });

    await test.step('Verify error message appears', async () => {
        const errorMessage = page.locator('.ui-toast-message-content');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toHaveText(/invalid user/i);
    });
});

// Configure the test to take a screenshot on failure for all tests
// Keywords: screenshot, afterEach, failure, testInfo

test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        await page.screenshot({ path: `screenshots/${testInfo.title}.png`, fullPage: true });
    }
});
```

**Note:** Always use `test.setTimeout(240_000)` or higher for Playwright tests to avoid premature failures due to slow environments. Use `test.step` for clear structure and capture screenshots on failure using `afterEach`.
