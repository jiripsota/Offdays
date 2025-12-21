# Project Rules

## General
- **Editor Definition:** When referring to "editor" or "IDE", it always means **Antigravity**. No other editors are used.

## UI Components
- **Maximize Reuse:** Always use existing UI components from `@/components/ui` before creating new ones.
- **Unified Design:** Maintain consistent design, sizes, and element types across the application.
- **New Components:** If a new component is needed, install it (e.g., via shadcn/ui) and then use it.

## Multilingual Support (i18n)
- **Always Translate:** All text must be internationalized using `react-i18next`.
- **New Texts:** Create new translation keys for all supported languages immediately when adding new text.
- **Cleanup:** When removing code, also remove the corresponding translation keys from language files.

## Theme Support
- **Dark/Light Mode:** The application must natively support both light and dark modes. Use Tailwind CSS dark mode classes (`dark:...`) or CSS variables correctly.

## UX Patterns
- **Sheets over Modals:** Prefer `Sheet` components (side panels) over `Dialog`/`Modal` windows wherever possible.

## Naming Conventions
- **Component Suffixes:** Use descriptive suffixes that indicate the component's role or type.
  - **Structural:** `*Page` (routes), `*Layout` (wrappers), `*Provider` (context).
  - **UI Containers:** `*Panel` (embedded sections), `*Sheet` (side drawers), `*Modal`/`*Dialog` (popups).
  - **Data Display:** `*Table`, `*List`, `*Card`, `*Chart`.
  - **Interaction:** `*Form`, `*Button`, `*Input`.
- **Combined Suffixes:** When a component combines roles, combine suffixes (e.g., `*FormSheet` for a form inside a sheet, `*DetailPanel` for details in a panel).
- **Refactoring:** If the logic of a component changes significantly, rename the component to reflect its new purpose.

## Code Quality
- **Structure:** Keep code structured and readable.
- **Comments:** Add reasonable comments for humans to understand complex logic.
- **Proactive Fixes:** Immediately fix any errors or rule violations encountered during other tasks.
