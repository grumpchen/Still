# Dashboard button contrast

## Change

Adjusted only Dashboard glass styling. In light glass mode, secondary hero actions and Today buttons use a pale glass surface with dark text. In dark glass mode, they use a dark translucent surface with bright text. Hover states keep the same palette. The blue primary Ask AI button and other workspace/theme styles remain unchanged.

## Verification

- `STILL_PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium STILL_PLAYWRIGHT_PORT=4182 pnpm exec playwright test tests/e2e/dashboard-contrast.spec.ts --workers=1`: 3 passed, covering light glass, dark glass, and minimal light mode.
- Inspected the generated light and dark screenshots; secondary hero and Today `+ Event` buttons have readable text in both themes.
- Windows runtime verification was not performed.
