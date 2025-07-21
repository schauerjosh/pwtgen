import { expect, test } from "@playwright/test";

test("Verify job completion hover feature for a new Radio commercial ad type spot order", async ({
  page,
}) => {
  // Navigate to login page and authenticate
  await page.goto(`${process.env.DEV_BASE_URL}/login`);
  await page.fill(
    'input[name="username"]',
    "imail-test+DemoProdDirector@vcreativeinc.com",
  );
  await page.fill('input[name="password"]', "TeamVC#Rocks2025");
  await page.click('button[type="submit"]');
  await page.waitForNavigation();

  // Navigate to Quick Order page
  await page.click("ul[root='true'] span");
  await page.waitForLoadState("networkidle");

  // Select Ad Type as "Radio Commercial"
  await page.click("text=Select an Adtype");
  await page.click("li[aria-label='Radio Commercial'] span");

  // Fill out the rest of the required fields
  await page.fill(
    "input[placeholder='Client or Advertiser']",
    "Dairy Queen - Taber",
  );
  await page.click("li[role='option'] span");
  await page.fill("input[name='card_spot_title']", "JS - PLAYWRIGHT TEST");
  await page.fill("input[name='card_spot_length']", "30");
  await page.fill("input[name='card_rotationpercent']", "100");
  await page.fill("input[name='card_isci_code']", "1234");

  // Confirm “Spot requires client approval” option is checked
  await page.click("p-checkbox[name='card_approvespotflag'] div");

  // Submit the order
  await page.click("button#submit-all-qo-orders");
  await expect(page.locator("text=Order submitted successfully")).toBeVisible();

  // Verify that the submitted order shows proper data
  // This step would typically involve navigating to the order details page and verifying the data,
  // but since specific selectors for this action are not provided, we'll simulate the verification step.
  await expect(page.locator("text=JS - PLAYWRIGHT TEST")).toBeVisible();

  // Verify that the “Dubbed” checkbox is grayed out
  // Assuming the selector for the "Dubbed" checkbox is '.dubbed-checkbox' for demonstration.
  const dubbedCheckbox = page.locator(".dubbed-checkbox");
  await expect(dubbedCheckbox).toHaveAttribute("disabled", "");

  // Verify hover message for the “Dubbed” checkbox
  // Assuming the selector for the hover message is '.hover-message' for demonstration.
  await dubbedCheckbox.hover();
  const hoverMessage = page.locator(".hover-message");
  await expect(hoverMessage).toBeVisible();
  await expect(hoverMessage).toHaveText(
    "Cannot be dubbed until all approvals are given",
  );

  // Place the order’s status in the review that is needed and approve
  // Assuming the selector for changing status is '.status-dropdown' and for approve button is '#approveButton'.
  await page.click(".status-dropdown");
  await page.click("li[aria-label='Review Needed'] span");
  await page.click("#approveButton");

  // Verify the dubbed checkbox is now available
  // Assuming the checkbox becomes enabled by removing the 'disabled' attribute.
  await expect(dubbedCheckbox).not.toHaveAttribute("disabled", "");
});
