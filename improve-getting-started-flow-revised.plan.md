# Improve Getting Started Flow (Revised)

The goal is to improve the `/getting-started` page to prevent users from getting stuck. We will auto-select an organization when navigating back to home, provide a logout option, and ensure the "Business Owner" button also allows navigation if an organization already exists.

## Proposed Changes

### `apps/web/src/routes/(organization)/getting-started.tsx`

1.  **State & Imports**:
    -   Import `authClient` from `@/lib/auth-client`.
    -   Track `firstOrganizationId` and `isLoading` state.

2.  **`handleBackToHome` Logic**:
    -   This function will be shared by "Volver a inicio" and the "Business Owner" button (when applicable).
    -   Logic:
        -   If user has organizations (`hasOrganizations` is true) but no active organization (`organization` is null), call `authClient.organization.setActive` with `firstOrganizationId`.
        -   Redirect to `/` (Home).

3.  **"Volver a inicio" Button**:
    -   Update `onClick` to use `handleBackToHome`.

4.  **"Business Owner" Button**:
    -   Currently: Disabled if `hasOrganizations` is true.
    -   Change: If `hasOrganizations` is true, enable the button.
    -   Text: Change to "Ir a inicio" (or similar) when `hasOrganizations` is true.
    -   Action: Call `handleBackToHome`.

5.  **Logout**:
    -   Add "Cerrar sesión" button to the Employee card.
    -   Implement `handleLogout` (`authClient.signOut` + redirect to `/login`).

## Verification Plan

-   **Scenario 1 (Employee / Stuck User)**:
    -   Click "Volver a inicio".
    -   Verify it sets the active org (if exists) and redirects to `/`.
-   **Scenario 2 (Business Owner with Org)**:
    -   Verify the button says "Ir a inicio" (instead of being disabled).
    -   Click it and verify it sets active org and redirects to `/`.
-   **Scenario 3 (Logout)**:
    -   Click "Cerrar sesión" and verify redirect to `/login`.

