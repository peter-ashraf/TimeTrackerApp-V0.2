# Seamless Theme Switching Implementation Plan

## Goal
To allow users to switch between the Classic (V1) and Bento (V2) designs seamlessly at runtime without requiring a page reload or rebuilding the application. 

## Current State
- The toggle button in the `Settings` menu correctly updates the global state (`userPreferences.designVersion` to either `'bento'` or `'legacy'`).
- The CSS files for both layouts exist.
- However, the actual React component files (`Settings.jsx`, `Timesheet.jsx`, etc.) were directly overwritten with the new Bento code. We currently do not have the Legacy code and Bento code co-existing in the `src/components` directory.

## Implementation Steps

### Phase 1: Component Restoration & Separation
1. **Retrieve Legacy Components:**
   - Check out the `main-backup-before-bento` branch temporarily (or view its files).
   - Copy the original classic component files (e.g., `Settings.jsx`, `Timesheet.jsx`, `Dashboard.jsx`, `Header.jsx`).
   - Save them into the `src/components` folder with the suffix `Legacy` (e.g., `SettingsLegacy.jsx`).
   
2. **Rename Bento Components:**
   - Rename the current, newly designed files to have a `Bento` suffix (e.g., `SettingsBento.jsx`, `TimesheetBento.jsx`).

### Phase 2: Building Wrapper Components (The Switcher)
For every major view that has two distinct designs, we will create a "Wrapper Component" that serves as a traffic director.

Example for `Settings.jsx`:
```jsx
import { useUserPreferences } from "../context/UserPreferencesContext";
import SettingsLegacy from "./SettingsLegacy";
import SettingsBento from "./SettingsBento";

export default function Settings() {
  const { userPreferences } = useUserPreferences();
  const isBento = userPreferences?.designVersion !== 'legacy';

  return isBento ? <SettingsBento /> : <SettingsLegacy />;
}
```
*Repeat this wrapper pattern for `Timesheet`, `Dashboard`, etc.*

### Phase 3: CSS & Layout Scoping
1. **Global Styles:** Ensure that global background colors or gradients in `App.jsx` or `index.html` adapt based on the active theme. We can achieve this by appending a dynamic class (e.g., `<body className={isBento ? 'theme-bento' : 'theme-legacy'}>`).
2. **CSS Isolation:** Verify that the Legacy CSS files don't accidentally style elements in the Bento components, and vice versa. 

### Phase 4: Testing & Polish
- Switch back and forth rapidly between the two themes.
- Ensure that modal overlays, backdrop filters, and z-indexes are stable across both layouts.
- Verify that performance is smooth (React handles conditional rendering highly efficiently, so it will be fast).
