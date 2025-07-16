---
type: workflow
category: poc-management
---

# POC Assignment Workflow

## Point of Contact (POC) Assignment Process
This workflow covers assigning and managing Points of Contact for spots/orders.

### Step-by-Step Process
1. **Search for Spot**: Locate the target spot
2. **Access Status**: Click status link to modify
3. **Update Status**: Change to appropriate status (e.g., "Spot Review")
4. **Access Cart**: Click cart ID for detailed view
5. **Approve if Needed**: Use approve button if required
6. **Assign POC**: Select appropriate person for specific jobs
7. **Verify Assignment**: Confirm assignment was successful

### Playwright Implementation
```typescript
import { test, expect } from '@playwright/test';

test('Assign POC to Spot', async ({ page }) => {
  // 1. Search for spot
  await page.fill('.search-input', 'spot title or identifier');
  await page.click('button[id="do-search-btn"] span');
  await page.waitForTimeout(5000);

  // 2. Access status
  await page.click('.po-text-status-link');

  // 3. Update status
  await page.click("ul#pr_id_9_list >> text=Spot Review");

  // 4. Access cart details
  await page.click('.po-text-cart-id');

  // 5. Approve if needed
  await page.click('#approveButton');

  // 6. Assign dubber
  await page.click('#poc-job-span-Dubber');
  await page.fill('.search-field', 'demo prod director');
  await page.click('.ui-dropdown-item:has-text("Demo Prod Director")');

  // 7. Verify assignment
  await page.waitForTimeout(1000);
  const pocCell = page.locator('td.poc-column').filter({ hasText: 'Producer' });
  await expect(pocCell.locator('div[appuser].job-completed')).toHaveText('Demo Prod Director');
});
```

## Available Job Types
- **Producer**: Content creation and production
- **Dubber**: Audio dubbing and voice work
- **Traffic**: Scheduling and traffic management
- **Sales**: Account management and client relations

## Auto-Assignment Rules
Some ad types have auto-assignment enabled:
- Auto dub enabled ad types cannot have manual dubber assignment
- System will show toast message: "Auto dub is enabled. The manual assignment of a dubber is not allowed for this ad type."

## POC Search and Assignment
- Use `.search-field` to find assignees
- Type partial names to filter results
- Click `.ui-dropdown-item` to select
- Verify assignment in `.job-completed` field

## Error Handling
- Handle cases where POC is already assigned
- Check for auto-assignment conflicts
- Verify user permissions for assignment
- Handle network timeouts during assignment
