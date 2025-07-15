---
type: workflow
category: authentication
---

# Authentication Workflow

## Standard Login Flow
1. Navigate to login page
2. Fill username field
3. Fill password field
4. Click login button
5. Wait for dashboard to load

## Code Example
```typescript
await page.goto(process.env.BASE_URL + '/login');
await page.getByLabel('Username').fill(process.env.TEST_USERNAME!);
await page.getByLabel('Password').fill(process.env.TEST_PASSWORD!);
await page.getByRole('button', { name: /sign in/i }).click();
await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
```
