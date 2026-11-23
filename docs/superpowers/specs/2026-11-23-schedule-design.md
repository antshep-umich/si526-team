# Schedule tab (SCRUM-73), design notes

_2026-11-23, Anthony + Claude. Branch `Ant-Dev-Schedule`._

## What Figma has, and what's a placeholder

Figma "SCRUM-73 Schedule Page" (section 833:941) has one real frame, 837:1483: the header
"Schedule" with the menu, a Week | Month switch, an All | Mine filter, a day heading
("Thursday, Nov 19") and the Chore List's cards with their dropdowns. The other frame in
the section, "Schedule" (837:1385), is a copy of the profile page and is ignored.

Figma has no week strip, no date range, no previous/next arrows, no "Today" and no month
view. Those are placeholders built from the design system's tokens until UX designs them
(README Conflicts).

## Decisions

- **Week** (opens first): the range "Nov 16 to Nov 22" between previous / next arrows, with
  "Today" beside them, and a strip of seven days, Monday to Sunday. Each day shows its
  weekday letter, date, and the number of chores due that day; a dot marks a day with an
  overdue chore. Today has a ring; the selected day is filled.
- **Month** (Anthony, 2026-11-23): a calendar of the month, Monday to Sunday, each day with
  its count and the overdue dot, with the same arrows and "Today". Tapping a day lists its
  chores underneath, as in Week. It is not SCRUM-47's monthly history.
- **Which day is selected:** today when the week or month shown has it, otherwise its first
  day. "Today" goes back to the current week or month with today selected. Switching Week
  and Month keeps the selected day.
- **Overdue chores** (Anthony, 2026-11-23): counted and marked on the day they were due, and
  also listed first under today, so they aren't missed. They don't add to today's count.
- **Cards:** the Chore List's card, checkbox (assignee only) and dropdown (Chore details,
  SCRUM-53) included. Edit chore and a chore's history open from it and come back to the
  Schedule where it was.
- **Mine | All:** the same remembered filter as the Chore List; one choice for both tabs.
  Mine counts and lists only the user's chores.
- **Messages:** "No chores on this day." and "We couldn't load the schedule. Please try
  again." with a "Retry" button (the story's words).
- **Data:** `GET /api/chores?since=` (every open chore, plus those done or due since the
  date), from the first day shown. Going back further loads again; going forward doesn't.
  The screen checks for changes every 10 s, like the Chore List.
- **Time zone:** days are the phone's, as everywhere in the app; households have no time
  zone (answer for the story's feasibility check).
- **Not built:** AC9 only points to SCRUM-46; no weekly summary on the Schedule.
