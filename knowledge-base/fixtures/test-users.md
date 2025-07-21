---
type: fixture
category: test-data
---

# Test User Fixtures

## Valid Test Users
```typescript
export const validUsers = [
  {
    email: "imail-test+DemoProdDirector@vcreativeinc.com",
    password: "TeamVC#Rocks2025",
    role: "Production Director",
    canGhost: false
  },
  {
    email: "imail-test+CypressTestUser@vcreativeinc.com", 
    password: "TeamVC#Rocks2025",
    role: "Test User",
    canGhost: true
  },
  {
    email: "imail-test+DemoTrafficDirector@vcreativeinc.com",
    password: "TeamVC#Rocks2025",
    role: "Traffic Director",
    canGhost: false
  }
];
```

## Invalid Test Users (for negative testing)
```typescript
export const invalidUsers = [
  {
    email: "invalidUser@example.com",
    password: "wrongPassword",
    expectedError: "Invalid credentials"
  },
  {
    email: "missingAtSymbol.com",
    password: "somePassword", 
    expectedError: "Invalid email format"
  },
  {
    email: "missingDomain@.com",
    password: "somePassword",
    expectedError: "Invalid email format"
  },
  {
    email: "emptyEmail@",
    password: "somePassword",
    expectedError: "Invalid email format"
  }
];
```

## Environment URLs
```typescript
export const environments = {
  dev: "https://dev.vcreative.net",
  test: "https://two-test.vcreative.net", 
  staging: "https://staging.vcreative.net",
  prod: "https://vcreative.net"
};
```

## Usage in Tests
```typescript
import { validUsers, invalidUsers } from './fixtures/test-users';

test('Login with valid user', async ({ page }) => {
  const user = validUsers[0]; // Demo Prod Director
  await page.goto(process.env.BASE_URL + '/login');
  await page.fill('input[name="username"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await expect(page.locator('.vcreative-icon')).toBeVisible();
});
```
