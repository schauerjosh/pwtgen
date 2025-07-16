---
type: workflow
category: spot-management
---

# Spot/Order Creation Workflow

## Quick Order Creation Process
This workflow covers creating a Spot, Order, Quick Order (QO), or Purchase Order (PO) in vProMedia.

### Step-by-Step Process
1. **Access Quick Order**: Click Quick Order button
2. **Select Ad Type**: Choose appropriate ad type from dropdown
3. **Get Form UUID**: Extract form UUID for dynamic selectors
4. **Configure Multiselect Options**: Handle any multiselect dropdowns
5. **Fill Client Information**: Enter client/advertiser details
6. **Enter Spot Details**: Title, length, rotation, ISCI code
7. **Set Status**: Select appropriate status (e.g., "Needs Producing")
8. **Configure Dates**: Set start, end, and due dates
9. **Station Selection**: Choose target stations
10. **Set Approval**: Configure approval requirements
11. **Submit**: Submit the order if all required fields are complete

### Playwright Implementation
```typescript
import { test, expect } from '@playwright/test';

test('Create Quick Order', async ({ page }) => {
  // 1. Click Quick Order
  await page.click("ul[root='true'] span");

  // 2. Select Adtype
  await page.click("text=Select an Adtype");
  await page.click("li[aria-label='Radio Commercial'] span");

  // 3. Get form UUID (if needed for dynamic selectors)
  const formUUID = await page.locator('#form-id-hidden-div').textContent();

  // 4. Fill client information
  await page.fill("input[placeholder='Client or Advertiser']", 'Dairy Queen - Taber');
  await page.click("li[role='option'] span");

  // 5. Fill spot details
  await page.fill("input[name='card_spot_title']", 'JS - PLAYWRIGHT TEST');
  await page.fill("input[name='card_spot_length']", '30');
  await page.fill("input[name='card_rotationpercent']", '100');
  await page.fill("input[name='card_isci_code']", '1234');

  // 6. Select status
  await page.click("text=Select Status");
  await page.fill("input.ui-dropdown-filter", 'Needs Producing');
  await page.click("li[aria-label='Needs Producing'] span");

  // 7. Configure dates (using today's date)
  await page.click("p-calendar[name='card_start_date']");
  await page.click("td.ui-datepicker-today a");

  await page.click("p-calendar[name='card_end_date']");
  await page.click("td.ui-datepicker-today a");

  await page.click("p-calendar[name='card_due_date']");
  await page.click("td.ui-datepicker-today a");

  // 8. Select station
  await page.click("label:has-text('CHBW-FM B94')");
  await page.fill("#contract_CHBW-FM B94", '12312322');

  // 9. Set approval
  await page.click("p-checkbox[name='card_approvespotflag'] div");

  // 10. Submit (only if no missing fields)
  const missingFields = await page.locator('#missing-fields-tool-tip-icon').isVisible();
  if (!missingFields) {
    await page.click("button#submit-all-qo-orders");
    await expect(page.locator('text=Order submitted successfully')).toBeVisible();
  }
});
```

## Validation Rules
- All required fields must be completed before submission
- ISCI codes must be unique
- Dates must be in logical order (start <= end, due date appropriate)
- Station contracts must be valid
- File attachments must be supported formats (.mp3, .mp4, .jpg, .jpeg, .mov)

## Common Issues
- **Missing Fields**: Check for `#missing-fields-tool-tip-icon` before submitting
- **Invalid Dates**: Ensure dates are selectable and in correct format
- **Station Selection**: Verify station is available and contract number is valid
- **File Upload**: Ensure file paths are accessible and formats are supported
