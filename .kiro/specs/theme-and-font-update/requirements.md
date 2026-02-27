# Requirements Document

## Introduction

This feature updates the personal portfolio/CV website to support automatic light/dark theming based on the user's browser preference, and replaces the heading font (DM Serif Display) with a more modern sans-serif choice while preserving the existing body and monospace fonts.

## Glossary

- **Site**: The static HTML/CSS/JS personal portfolio website served from index.html, style.css, and grain.js
- **Theme**: A named set of CSS custom property values (colors) applied to the Site
- **Dark_Theme**: The existing color scheme (dark background #0E1116, dark surface #141920, light text #E6E6E6)
- **Light_Theme**: A new color scheme with light backgrounds and dark text, designed to complement the Dark_Theme
- **Browser_Preference**: The user's operating system or browser-level color scheme setting, exposed via the CSS `prefers-color-scheme` media query
- **Heading_Font**: The font family applied to the h1 element displaying the site owner's name
- **Grain_Overlay**: The canvas-based animated noise effect rendered by grain.js

## Requirements

### Requirement 1: Dark Theme via Media Query

**User Story:** As a visitor using dark mode, I want the site to display a dark color scheme matching my system preference, so that the existing visual identity is preserved.

#### Acceptance Criteria

1. WHEN the Browser_Preference is set to dark, THE Site SHALL apply the Dark_Theme colors for CSS custom properties (--bg, --surface, --border, --accent, --text, --text-dim, --text-meta) inside a `prefers-color-scheme: dark` media query
2. THE Site SHALL NOT define theme color values as bare defaults on `:root` outside of a media query
3. THE Dark_Theme SHALL define a dark background color (#0E1116) for --bg
4. THE Dark_Theme SHALL define a dark surface color (#141920) for --surface
5. THE Dark_Theme SHALL define light text colors for --text, --text-dim, and --text-meta that maintain readable contrast against the dark background

### Requirement 2: Light Theme via Media Query

**User Story:** As a visitor using light mode, I want the site to display a light color scheme matching my system preference, so that it is comfortable to read.

#### Acceptance Criteria

1. WHEN the Browser_Preference is set to light, THE Site SHALL apply the Light_Theme colors for CSS custom properties (--bg, --surface, --border, --accent, --text, --text-dim, --text-meta) inside a `prefers-color-scheme: light` media query
2. THE Light_Theme SHALL define a light background color for --bg
3. THE Light_Theme SHALL define a light surface color for --surface
4. THE Light_Theme SHALL define an appropriately visible border color for --border
5. THE Light_Theme SHALL define dark text colors for --text, --text-dim, and --text-meta that maintain readable contrast against the light background
6. THE Light_Theme SHALL preserve the same --accent color or adjust it to maintain accessible contrast against the light background

### Requirement 3: Fallback When No Preference Is Detected

**User Story:** As a visitor whose browser does not report a color scheme preference, I want the site to still render with a complete color scheme, so that the page is not unstyled.

#### Acceptance Criteria

1. WHEN the Browser_Preference is not available, THE Site SHALL display the Dark_Theme as the fallback
2. THE Site SHALL define the Dark_Theme colors as bare `:root` custom property values solely as a fallback for browsers that do not support `prefers-color-scheme`
3. THE Site SHALL structure the fallback so that it is overridden by either the dark or light media query when the Browser_Preference is available

### Requirement 4: Theme-Aware Interactive Elements

**User Story:** As a visitor, I want hover states, card shadows, and link colors to look correct in both themes, so that the site feels polished regardless of color scheme.

#### Acceptance Criteria

1. WHEN the Light_Theme is active, THE Site SHALL adjust the doc-card hover shadow to use a lighter, softer shadow appropriate for a light background
2. WHEN the Light_Theme is active, THE Site SHALL adjust the doc-card hover border color to be visible against the light surface
3. WHEN the Light_Theme is active, THE Site SHALL ensure link hover colors remain distinguishable from default link colors

### Requirement 5: Theme-Aware Grain Overlay

**User Story:** As a visitor, I want the grain overlay to remain subtle in both themes, so that it adds texture without reducing readability.

#### Acceptance Criteria

1. WHEN the Light_Theme is active, THE Site SHALL adjust the Grain_Overlay opacity so the noise effect remains subtle and does not darken the light background excessively
2. THE Grain_Overlay SHALL remain a purely decorative element with no impact on text readability in either theme

### Requirement 6: Replace Heading Font

**User Story:** As the site owner, I want the h1 name heading to use a modern sans-serif font instead of DM Serif Display, so that the typography feels more cohesive and contemporary.

#### Acceptance Criteria

1. THE Site SHALL replace the Heading_Font from DM Serif Display to a sans-serif font (such as Roboto, Inter at a heavier weight, or another tasteful sans-serif available from Google Fonts)
2. THE Site SHALL load the replacement Heading_Font via the existing Google Fonts link
3. THE Site SHALL remove the DM Serif Display font from the Google Fonts import if it is no longer used anywhere
4. THE Site SHALL update the --font-serif CSS custom property or replace its usage with the new Heading_Font family
5. THE Heading_Font SHALL maintain a visually prominent appearance for the h1 element (appropriate size and weight to serve as the page's primary heading)

### Requirement 7: No Layout or Content Regression

**User Story:** As the site owner, I want the layout, spacing, and content to remain unchanged, so that only the theme and font are updated.

#### Acceptance Criteria

1. THE Site SHALL preserve all existing page structure, spacing, and responsive behavior after the theme and font changes
2. THE Site SHALL not introduce any new HTML elements beyond what is needed for theming
3. THE Site SHALL not require JavaScript changes for theme switching (CSS-only approach via media queries)
