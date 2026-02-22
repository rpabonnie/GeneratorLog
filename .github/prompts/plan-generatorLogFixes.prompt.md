## Plan: Fix Dashboard, Links, Auth, Theme

We will update the months-left gauge to use installedAt when no last oil change date exists, ensure QR/deep-link/shortcut downloads use the Azure public base URL and embed the current API key into the shortcut file, add a manual download button, implement both logged-in password change and email-based password reset, and refresh branding + theme colors to the requested washed green palette. This touches frontend UI, backend shortcut generation, config, auth routes, and DB migrations. We will keep dependencies minimal and align API_BASE_URL with the Azure URL while keeping VITE_API_URL consistent.

**Steps**
1. Update the dashboard months-left calculation to fall back to generator.installedAt when lastOilChangeDate is missing, and keep the gauge logic consistent with oilChangeMonths in frontend/src/components/DashboardPage.tsx.
2. Ensure the backend uses the Azure public base URL for QR and shortcut links, and embed the API key directly in the generated shortcut plist (replace the import question flow) in backend/src/config.ts, backend/src/routes/api-keys.ts, and backend/src/utils/shortcut.ts.
3. Add a clear manual download button on the existing setup page (per preference) that points to the same shortcut file URL in frontend/src/components/ShortcutSetupPage.tsx and style it in its CSS file. (The button already exists, is just that the user has to exit the api key creation modal then use the show qr code button to finally see the button to manually download the file.)
4. Implement password reset features:
   - Logged-in password change route + UI in backend/src/routes/auth.ts and frontend/src/components/ProfilePage.tsx.
   - Email-based reset flow with tokens and expiry in the DB via new drizzle migration and logic in backend/src/db/schema.ts, backend/src/routes/auth.ts, and email dispatch in backend/src/services/email.ts. Add a “Forgot password?” link to frontend/src/components/LoginPage.tsx.
5. Change branding text to “Generator Log” in the HTML title and layout header: frontend/index.html and frontend/src/components/Layout.tsx.
6. Replace intense green theming with washed palette derived from #66ac92, #015c53, #dceae5 using CSS variables and update component styles where hard-coded greens appear, starting in frontend/src/index.css, plus the component CSS files referenced by the dashboard and API key/shortcut pages.

**Verification**
- Backend: run targeted tests for auth and maintenance logic if present; otherwise run pnpm --filter generatorlog-backend test.
- Frontend: run pnpm --filter frontend test:e2e if available; otherwise manual check dashboard gauge, QR import, manual download, and reset flows.
- Manual: confirm the QR code and download link use https://generatorlog.azurewebsites.net/ and that the imported shortcut already contains the API key.

**Decisions**
- Use both logged-in password change and email-based reset.
- Keep manual shortcut download on the existing setup page.
- Use the Azure base URL for QR/shortcut links and embed the API key into the shortcut file.
