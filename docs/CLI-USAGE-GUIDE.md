# Enhanced CLI Usage Guide

## Generate Playwright Test from Natural Language

```bash
npx ts-node src/cli-enhanced.ts generate-test --description "Login to the dashboard" --url "https://example.com" --testName "login test"
```

For interactive mode (step-by-step developer intervention):

```bash
npx ts-node src/cli-enhanced.ts generate-test --description "Login to the dashboard" --url "https://example.com" --testName "login test" --interactive
```

## Run Self-Healing on Existing Test

```bash
npx ts-node src/cli-enhanced.ts self-heal --file "tests/login.spec.ts"
```

---

# Integration Guide

## 1. Add Enhanced CLI to Your Project

Copy the enhanced CLI and core service files into your `src/` directory.

## 2. Install Dependencies

Ensure you have Playwright and TypeScript installed:

```bash
npm install playwright typescript ts-node
```

## 3. Usage

Use the CLI to generate tests from natural language or run self-healing.
For interactive test generation, use the `--interactive` flag.

## 4. Customization

Update the NaturalLanguageProcessor to support your application's specific flows.
Extend SelfHealingService for more advanced healing strategies.

---

# Sample Generated Test

```typescript
import { test, expect } from '@playwright/test';

test('login test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('https://example.com/dashboard');
});
```

---

# Step-by-Step Setup & Usage Guide

## 1. Copy Files
Place each file in the correct folder as shown above. Create any missing folders.

## 2. Install Dependencies
In your project root, run:

```bash
npm install playwright typescript ts-node
```

## 3. Try Generating a Test
Run:

```bash
npx ts-node src/cli-enhanced.ts generate-test --description "Login to the dashboard" --url "https://example.com" --testName "login test"
```

For interactive mode:

```bash
npx ts-node src/cli-enhanced.ts generate-test --description "Login to the dashboard" --url "https://example.com" --testName "login test" --interactive
```

## 4. Run Self-Healing
To heal selectors in an existing test file:

```bash
npx ts-node src/cli-enhanced.ts self-heal --file "sample-generated-test.spec.ts"
```

## 5. Review Documentation
See `docs/CLI-USAGE-GUIDE.md` and `docs/INTEGRATION-GUIDE.md` for more details.

## 6. Customize
Edit `NaturalLanguageProcessor.ts` and `SelfHealingService.ts` to fit your app’s needs.