# House tab (SCRUM-74), invite links and toasts: design

Agreed with Anthony on 2026-11-15, on `Ant-Dev-Sprint4`. There is no Figma design yet, so this is a
stand-in built from the existing design system until UX delivers screens. Keep it simple; it
will be redesigned.

## Why

SCRUM-74 asks for a House tab: see who lives in the household, see who manages chores, and invite
new housemates. Today the invite code shows only once, on Household Created!, and the House tab
does nothing. The story's acceptance criteria are in `acceptance/SCRUM-74.json`.

## Goals

1. **House page** in the House tab (third tab, now usable).
2. **Invite links**: `/join/CODE` opens the app ready to join that household.
3. **Toast**: one small component for the two pop-up messages the stories ask for.
4. **Polling**: the housemates list and the chore list stay current without a manual refresh.

## Non-goals

- A router. Only `/join/CODE` is read; every other screen keeps its single address.
- WebSockets.
- Household manager election (SCRUM-62), profiles (SCRUM-72, SCRUM-63), leaving (SCRUM-75).
- Toasts for "Chore added." or "Marked done. Undo" (dropped from SCRUM-6 and SCRUM-8 in Jira),
  or for SCRUM-8's save error.

## Anti-goals

- No flicker: background refreshes never show "Loading…", move the scroll position, close an open
  menu or row, or undo something the user just did.
- No one joins a household without tapping Join.

## Constraints

- AGENTS.md rules: six server layers, tokens only, reuse components, light and dark icon files,
  copy from the stories, the current user is "You", tests tagged by story with `ACn:` names.
- Mobile web at 402×874. Share uses the Web Share API (`navigator.share`), which iOS Safari and
  Android Chrome both support.
- No new API needed: `GET /api/households/current` already returns the name, invite code and
  members (id, name, role).

## Design (decided)

### House page (`src/screens/House.tsx`), layout "A"

In `TabLayout` with the House tab selected. From the top:

1. `Header`: title = household name, then "N members" under it (`--type-meta`), menu as on every
   household screen.
2. **Manager card** (card style as the chore histories): "Household manager" small label, then
   "No Household Manager assigned". No "Become household manager" button, and no
   "Household manager" chip on anyone, until SCRUM-62 exists.
3. **Housemates**: section title, then one card listing members. Each row: `Avatar` (initials),
   name (`--type-chore-name`), and a chevron. The user's own row shows their name with a small
   muted "You" beside it. Each row is a button that opens the profile placeholder.
4. **"Invite housemates"**: outline button. Tapping it replaces the button with the invite card,
   which stays open while the user is on the tab.

The invite card is Household Created!'s code card: "Invite code" overline, the code in the same
large style, a hint "Share this code so your housemates can join.", and a **share icon** button
in the card's top-right corner (`aria-label="Share invite link"`).

### Share icon

A new icon, `share`, 20×20, 2px rounded stroke: a rounded box open at the top with an arrow rising
out of it. Light file in `#6B5547`, dark file in `#BFAF9E` (the muted text colors), as the other icons.

- Tap: `navigator.share({ title: "Join <household>", text: "Join <household> on JAALS Chore Tracker.", url })`
  where `url` is `<current origin>/join/<inviteCode>`.
- No `navigator.share` (most desktop browsers): copy the link with `navigator.clipboard.writeText`
  and show the toast "Invite link copied." (SCRUM-74 AC5 as amended).
- The share sheet closed or cancelled: nothing happens.

### Housemate profile placeholder (`src/screens/HousemateProfile.tsx`)

In `TabLayout`, House tab selected. `Header` title = the housemate's name (or "You"'s own name),
a large `Avatar`, and "Profiles are coming soon." Tapping the House tab returns to the House page.
No Leave button anywhere on these screens (SCRUM-74 AC6: leaving lives on the profile, SCRUM-75).

### Errors

House page load fails: "We couldn't load your household. Please try again." with a "Retry" button
(SCRUM-74 AC7). Only the first load can show it; a failed background refresh keeps the last data.
SCRUM-74 AC8 has nothing to trigger it (the link is built from the code): no message is built.

### Tabs

`TabLayout` takes the selected tab. Chores and House are available; Schedule stays visible but
does nothing. Selecting Chores opens the chore list; selecting House opens the House page. The
menu stays the same on every tab.

### Invite links (`/join/CODE`)

Vercel already serves `index.html` for every non-API path, and Vite's dev server does the same.

- At startup, if the path is `/join/<code>`, the app keeps the code in `sessionStorage` and
  replaces the address with `/` (`history.replaceState`), so reloads and later links stay clean.
- Signed out: Log in and Sign up work as now. Once signed in, the steps below apply.
- Signed in without a household: open "Join a household" with the code already in the field. The
  user taps Join; errors are the existing SCRUM-32 ones.
- Signed in with a household: open the app as usual and forget the code.
- The code is forgotten once used (joined, or ignored as above).

### Toast (`src/components/Toast.tsx`)

Not designed; a placeholder:

- One toast at a time, fixed above the tab bar (16px gap) and centred in the 402px column.
- Reverse colors from tokens: background `--color-text-default`, text `--color-background-top`,
  `--type-body`, 12px corners, small shadow.
- Fades in, stays 4 seconds, fades out. No motion when the user prefers reduced motion.
- `role="status"` so screen readers announce it.
- A `ToastProvider` in `SignedIn` and a `useToast()` hook with `show(message)`, so the toast
  survives a screen change (Join → chore list).
- On the `/components.html` demo page.

Used for:

- "You joined [Household name]." after joining, on the chore list (SCRUM-32 AC3; remove that
  AC's "Not met yet" note once its test passes).
- "Invite link copied." (above).

### Polling (`src/usePolling.ts`)

A hook that runs a load function every 10 seconds while the page is visible
(`document.visibilityState`), once more when the user comes back to the app, and stops when the
screen unmounts. Results replace data in place: React re-renders only what changed.

- House page: loads the household itself (`getCurrentHousehold`) and refreshes it (members, name,
  code). The household `App` holds for the other screens isn't refreshed (builder's call: not needed
  yet).
- Chore list (`Home`): refresh the chores. Skip applying a refresh while a tick or untick is
  still saving, so it can't put a chore back the way it was.

## Tests

- SCRUM-74: one tagged test per AC that tests can reach (AC1, AC2, AC4, AC5, AC6, AC7). AC3's test
  checks the card text; its button part stays failing/open as its note says. AC8: nothing to test.
- SCRUM-32 AC3: the "You joined…" toast after joining.
- Unit tests for Toast, usePolling (fake timers), the `/join/CODE` reader, and the share fallback.
- One e2e test: open `/join/<code>` while signed in without a household, see the code filled in,
  join, see "You joined…".

## Docs

README Conflicts row 9 rewritten (only the two toasts remain, built as a placeholder), rows 30–31
updated; AGENTS.md (repo map, frontend notes, current state); TECH_SPEC §6 note on `/join/CODE`.

## Left to the builder

File layout inside these modules, exact spacing (follow nearby screens), the stand-in household
name in demo pages, and test structure.
