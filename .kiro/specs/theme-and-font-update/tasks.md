# Implementation Plan: Theme and Font Update

## Overview

Restructure the site's CSS custom properties into a parallel media query architecture (bare `:root` fallback + dark + light), update the heading font from DM Serif Display to Roboto 700, and add theme-aware adjustments for card shadows, hover borders, and grain opacity. Tests use a Node.js script with fast-check for property-based validation.

## Tasks

- [x] 1. Update Google Fonts link and heading font variable
  - [x] 1.1 Update the Google Fonts `<link>` in `index.html` to remove `DM+Serif+Display` and add `Roboto:wght@700`
    - Keep `Inter:wght@300;400;500` and `JetBrains+Mono:wght@300;400` unchanged
    - _Requirements: 6.2, 6.3_
  - [x] 1.2 Update the `--font-serif` CSS custom property in `style.css` to `--font-heading` with value `'Roboto', -apple-system, sans-serif`
    - Update `.identity h1` to reference the new `--font-heading` variable
    - Set `font-weight: 700` on the h1 for visual prominence
    - Remove any remaining references to DM Serif Display
    - _Requirements: 6.1, 6.4, 6.5_

- [x] 2. Restructure CSS custom properties into theme blocks
  - [x] 2.1 Refactor the bare `:root` block in `style.css` to contain only fallback dark theme color values and theme-independent font variables
    - Define `--bg: #0E1116`, `--surface: #141920`, `--border: #1E2530`, `--accent: #3E8E7E`, `--text: #E6E6E6`, `--text-dim: #8A8F98`, `--text-meta: #6B7280`
    - Keep `--font-heading`, `--font-sans`, `--font-mono` in bare `:root` (not theme-dependent)
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 2.2 Add `@media (prefers-color-scheme: dark) { :root { ... } }` block with all 7 color custom properties matching the fallback values
    - Values must be identical to the bare `:root` fallback block
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 2.3 Add `@media (prefers-color-scheme: light) { :root { ... } }` block with the light theme color palette
    - `--bg: #FAFAFA`, `--surface: #FFFFFF`, `--border: #E2E5E9`, `--accent: #2E7D6E`, `--text: #1A1A1A`, `--text-dim: #5A5F68`, `--text-meta: #7C8290`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Add theme-aware component adjustments
  - [x] 3.1 Add light-theme `.doc-card:hover` shadow and border overrides inside the `prefers-color-scheme: light` media query
    - Shadow: use `rgba(0,0,0,0.08)` for a softer shadow on light backgrounds
    - Border-color: use `#CBD0D8` for visibility against light surface
    - _Requirements: 4.1, 4.2_
  - [x] 3.2 Ensure link hover colors remain distinguishable from default link colors in light mode
    - Verify/adjust `a:hover` color within the light media query if needed
    - _Requirements: 4.3_
  - [x] 3.3 Add light-theme `#grain` opacity override inside the `prefers-color-scheme: light` media query
    - Set opacity to `0.02` (reduced from dark mode's `0.03`)
    - _Requirements: 5.1, 5.2_

- [x] 4. Checkpoint — Verify visual correctness
  - Ensure all CSS is valid and no layout regressions are introduced
  - Verify no new HTML elements were added beyond the font link change
  - Verify no JavaScript changes were made for theme switching
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 5. Set up test infrastructure and write tests
  - [x] 5.1 Create a Node.js test script (`test/theme.test.js`) with CSS and HTML parsing utilities
    - Install `fast-check` as a dev dependency
    - Write helper functions to parse `:root`, `@media (prefers-color-scheme: dark)`, and `@media (prefers-color-scheme: light)` blocks from `style.css`
    - Write a WCAG contrast ratio calculation helper
    - Write a helper to extract the Google Fonts URL from `index.html`
    - _Requirements: 1.1, 2.1, 3.2_
  - [x] 5.2 Write property test for theme text contrast (Property 1)
    - **Property 1: Theme text contrast meets accessibility threshold**
    - For each theme block, verify all text/bg pairs (`--text`, `--text-dim`, `--text-meta` against `--bg`) meet WCAG 4.5:1 contrast ratio
    - Use fast-check to generate theme instances and validate contrast
    - **Validates: Requirements 1.5, 2.5**
  - [x] 5.3 Write property test for theme block completeness (Property 2)
    - **Property 2: All theme blocks define the complete set of custom properties**
    - For each theme block (fallback, dark, light), verify all 7 required custom properties are present
    - Use fast-check to generate subsets of required property names and verify membership
    - **Validates: Requirements 1.1, 2.1, 3.2**
  - [x] 5.4 Write property test for fallback-dark equivalence (Property 3)
    - **Property 3: Fallback values equal dark theme values**
    - For each custom property in the bare `:root` fallback, verify its value matches the dark media query block
    - Use fast-check to generate property name selections and verify equality
    - **Validates: Requirements 3.1, 3.3**
  - [x] 5.5 Write unit tests for structural and font checks
    - Verify Google Fonts URL includes Roboto and excludes DM Serif Display (Req 6.2, 6.3)
    - Verify `--font-heading` references Roboto (Req 6.4)
    - Verify `.identity h1` no longer references DM Serif Display (Req 6.1)
    - Verify light mode `.doc-card:hover` shadow opacity is lower than dark mode (Req 4.1)
    - Verify light mode hover border color differs from dark mode (Req 4.2)
    - Verify `#grain` opacity in light query is less than dark mode (Req 5.1)
    - Verify no `prefers-color-scheme` logic in `grain.js` (Req 7.3)
    - Verify `--accent` against `--bg` in light theme meets 4.5:1 contrast (Req 2.6)
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 6.1, 6.2, 6.3, 6.4, 7.3_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Run the full test suite (`node test/theme.test.js` or equivalent)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific structural expectations against the CSS/HTML source files
- No JavaScript changes are needed for theming — CSS-only approach via media queries
