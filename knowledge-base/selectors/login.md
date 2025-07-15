---
type: selector
category: authentication
---

# Login Selectors

## Username Input
```
page.getByLabel('Username')
page.getByTestId('username-input')
page.locator('input[name="username"]')
```

## Password Input
```
page.getByLabel('Password')
page.getByTestId('password-input')
page.locator('input[name="password"]')
```

## Login Button
```
page.getByRole('button', { name: /sign in|login/i })
page.getByTestId('login-button')
```
