---
type: selector
category: authentication
---

# Authentication Selectors

## Login Form Elements
```typescript
// Username/Email input
page.fill('input[name="username"]', email)
page.fill('input[name="email"]', email)

// Password input
page.fill('input[name="password"]', password)

// Login button
page.click('button[type="submit"]')
page.click('button:has-text("Login")')
page.click('button:has-text("Sign In")')

// Product selector (vProMedia)
page.click('#vpro-media-product-selector-btn')

// Success indicator
page.locator('.vcreative-icon')
```

## Navigation Elements
```typescript
// Quick Order button
page.click("ul[root='true'] span")

// Search functionality
page.fill('.search-input', 'search term')
page.click('button[id="do-search-btn"] span')
```

## Form Elements
```typescript
// Client/Advertiser input
page.fill("input[placeholder='Client or Advertiser']", clientName)
page.click("li[role='option'] span")

// Spot title
page.fill("input[name='card_spot_title']", title)

// ISCI code
page.fill("input[name='card_isci_code']", isciCode)

// Spot length
page.fill("input[name='card_spot_length']", length)

// Rotation percentage
page.fill("input[name='card_rotationpercent']", rotation)
```

## Dropdown Selectors
```typescript
// Adtype selection
page.click("text=Select an Adtype")
page.click("li[aria-label='Radio Commercial'] span")

// Status selection
page.click("text=Select Status")
page.fill("input.ui-dropdown-filter", statusText)
page.click("li[aria-label='Needs Producing'] span")

// Generic dropdown
page.click('.ui-dropdown-item')
```

## Date Picker Elements
```typescript
// Date pickers
page.click("p-calendar[name='card_start_date']")
page.click("p-calendar[name='card_end_date']")
page.click("p-calendar[name='card_due_date']")

// Date picker elements with form UUID
page.click("#date-picker-element-{formUUID}-start_date")
page.click("#date-picker-element-{formUUID}-end_date")

// Today selector
page.click("td.ui-datepicker-today a")
```

## POC Assignment Selectors
```typescript
// POC job containers
page.click('.poc-job-container')
page.click('#poc-job-span-Dubber')
page.click('#poc-job-span-Producer')

// POC assignment
page.fill('.search-field', assigneeName)
page.click('.ui-dropdown-item')

// Job completion verification
page.locator('div[appuser].job-completed')
```

## File Upload Elements
```typescript
// File upload
page.setInputFiles("input[type='file']", filePath)

// File attachment
page.click("input[type='file']")
```

## Action Bar Elements
```typescript
// Submit buttons
page.click("button#submit-all-qo-orders")
page.click("button:has-text('Save Spot')")

// Approval elements
page.click('#approveButton')
page.click("p-checkbox[name='card_approvespotflag'] div")
```

## Status and Cart Elements
```typescript
// Status links
page.click('.po-text-status-link')
page.click("ul#pr_id_9_list >> text=Spot Review")

// Cart ID
page.click('.po-text-cart-id')
```
