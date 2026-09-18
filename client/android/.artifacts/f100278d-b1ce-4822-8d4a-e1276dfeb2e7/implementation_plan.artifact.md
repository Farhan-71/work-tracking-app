# Implementation Plan - Fix Profile Name Persistence

The user reported that the name edited in the profile section is not changing correctly. This is because the user name is currently hardcoded in the Home screen and managed as local state within the Profile screen. I will lift this state to the main `App` component and ensure it is synchronized across all screens.

## User Review Required

> [!IMPORTANT]
> The Home screen currently displays the name in a "Two-Line" format (e.g., "ALEX\nJOHNSON"). I will implement logic to automatically split the user-provided name into two lines at the first space to preserve this design aesthetic.

## Proposed Changes

### [Component] App Initialization & State Management

I will move the `userName` state to the `App` component and pass it down as props.

#### [MODIFY] [App.jsx](file:///C:/Users/Hp/Desktop/Daily work tracking app/client/src/App.jsx)
- **Lift State:** Add `const [userName, setUserName] = useState("Alex Johnson");` to the `App` component.
- **Hydration:** Update the `hydrateStorage` function in `App` to load the saved username from storage.
- **Persistence:** Add a `useEffect` in `App` to save the username to storage whenever it changes.
- **Prop Injection:** Pass `userName` and a new `updateUserName` callback to `HomeScreen` and `ProfileScreen`.

---

### [Component] UI Synchronization

#### [MODIFY] [HomeScreen](file:///C:/Users/Hp/Desktop/Daily work tracking app/client/src/App.jsx)
- Receive `userName` as a prop.
- Replace the hardcoded "ALEX\nJOHNSON" with logic that splits the `userName` prop (e.g., `userName.split(" ")[0]` and the rest).

#### [MODIFY] [ProfileScreen](file:///C:/Users/Hp/Desktop/Daily work tracking app/client/src/App.jsx)
- Remove the local `userName` state.
- Use the `userName` prop for display and editing.
- Call the `updateUserName` callback from `App` when saving the edited name.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to ensure the new state logic is syntactically correct.

### Manual Verification
1. Open the app and navigate to the **Profile** screen.
2. Edit the name (e.g., change "Alex Johnson" to "John Doe").
3. Click the save checkmark.
4. Navigate back to the **Home** screen.
5. Verify that the greeting now says "JOHN\nDOE" (or your specific name).
6. Close and reopen the app to ensure the name persisted through a restart.
