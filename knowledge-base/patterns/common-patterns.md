---
type: pattern
category: best-practices
---

# Common Playwright Patterns

## Waiting for Elements
```typescript
// Good - use expect with timeout
await expect(page.locator('.loading')).toBeVisible();
await expect(page.locator('.loading')).toBeHidden();

// Better - wait for specific state
await page.waitForLoadState('networkidle');
```

## Form Interactions
```typescript
// Fill form fields
await page.getByLabel('Email').fill('user@example.com');
await page.getByLabel('Password').fill('password123');

// Submit form
await page.getByRole('button', { name: /submit|save/i }).click();
```

## Navigation
```typescript
// Navigate and wait
await page.goto('/dashboard');
await page.waitForLoadState('networkidle');
await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
```
