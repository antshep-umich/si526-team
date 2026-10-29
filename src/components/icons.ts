// Icons exported from Figma (Components page). Their colors are drawn into each file,
// so every icon has a light-mode and a dark-mode version. Use them through ThemedIcon.
import alertDark from "../assets/icons/dark/alert.svg";
import calendarDark from "../assets/icons/dark/calendar.svg";
import checkDark from "../assets/icons/dark/check.svg";
import checkboxOverdueDark from "../assets/icons/dark/checkbox-overdue.svg";
import checkboxPendingDark from "../assets/icons/dark/checkbox-pending.svg";
import chevronDownDark from "../assets/icons/dark/chevron-down.svg";
import chevronUpDark from "../assets/icons/dark/chevron-up.svg";
import clockDark from "../assets/icons/dark/clock.svg";
import eyeOffDark from "../assets/icons/dark/eye-off.svg";
import eyeOpenDark from "../assets/icons/dark/eye-open.svg";
import menuDark from "../assets/icons/dark/menu.svg";
import tabChoresActiveDark from "../assets/icons/dark/tab-chores-active.svg";
import tabChoresDark from "../assets/icons/dark/tab-chores.svg";
import tabHouseActiveDark from "../assets/icons/dark/tab-house-active.svg";
import tabHouseDark from "../assets/icons/dark/tab-house.svg";
import tabScheduleActiveDark from "../assets/icons/dark/tab-schedule-active.svg";
import tabScheduleDark from "../assets/icons/dark/tab-schedule.svg";
import alertLight from "../assets/icons/light/alert.svg";
import calendarLight from "../assets/icons/light/calendar.svg";
import checkLight from "../assets/icons/light/check.svg";
import checkboxOverdueLight from "../assets/icons/light/checkbox-overdue.svg";
import checkboxPendingLight from "../assets/icons/light/checkbox-pending.svg";
import chevronDownLight from "../assets/icons/light/chevron-down.svg";
import chevronUpLight from "../assets/icons/light/chevron-up.svg";
import clockLight from "../assets/icons/light/clock.svg";
import eyeOffLight from "../assets/icons/light/eye-off.svg";
import eyeOpenLight from "../assets/icons/light/eye-open.svg";
import menuLight from "../assets/icons/light/menu.svg";
import tabChoresActiveLight from "../assets/icons/light/tab-chores-active.svg";
import tabChoresLight from "../assets/icons/light/tab-chores.svg";
import tabHouseActiveLight from "../assets/icons/light/tab-house-active.svg";
import tabHouseLight from "../assets/icons/light/tab-house.svg";
import tabScheduleActiveLight from "../assets/icons/light/tab-schedule-active.svg";
import tabScheduleLight from "../assets/icons/light/tab-schedule.svg";

export const icons = {
  /** 14×14, error/text */
  alert: { light: alertLight, dark: alertDark },
  /** 15×15, on success/default */
  check: { light: checkLight, dark: checkDark },
  /** 44×44 tap target with a ring in overdue/line */
  checkboxOverdue: { light: checkboxOverdueLight, dark: checkboxOverdueDark },
  /** 44×44 tap target with a ring in action/primary */
  checkboxPending: { light: checkboxPendingLight, dark: checkboxPendingDark },
  /** 22×22, overdue/on-fill */
  clock: { light: clockLight, dark: clockDark },

  // Added with the chores screens. Figma has no dark exports for these yet, so the dark
  // files are the light ones recolored to the dark token (text/default #F3EBDD for the
  // menu, text/muted #BFAF9E for the rest).
  /** 24×24, text/default */
  menu: { light: menuLight, dark: menuDark },
  /** 20×20, text/muted */
  chevronDown: { light: chevronDownLight, dark: chevronDownDark },
  /**
   * 20×20, text/muted. Figma draws this as the down chevron turned 180° on the canvas,
   * and the export is unturned, so callers rotate it (see DoneSection and PickerField).
   */
  chevronUp: { light: chevronUpLight, dark: chevronUpDark },
  /** 20×20, text/muted */
  calendar: { light: calendarLight, dark: calendarDark },
  /** 24×24, text/muted. The password is hidden; pressing shows it. */
  eyeOff: { light: eyeOffLight, dark: eyeOffDark },
  /** 24×24, text/muted. The password is shown; pressing hides it. */
  eyeOpen: { light: eyeOpenLight, dark: eyeOpenDark },

  // Tab bar icons, 24×24: active tabs in action/primary, inactive tabs in text/muted.
  // Figma had no dark export for dark/tab-chores, dark/tab-schedule-active and
  // dark/tab-house-active, so those three are the light files with the stroke changed
  // to the dark token (#BFAF9E inactive, #E0876A active). Recoloring the other light
  // tab icons the same way reproduces Figma's dark exports byte for byte.
  tabChoresActive: { light: tabChoresActiveLight, dark: tabChoresActiveDark },
  tabChores: { light: tabChoresLight, dark: tabChoresDark },
  tabScheduleActive: { light: tabScheduleActiveLight, dark: tabScheduleActiveDark },
  tabSchedule: { light: tabScheduleLight, dark: tabScheduleDark },
  tabHouseActive: { light: tabHouseActiveLight, dark: tabHouseActiveDark },
  tabHouse: { light: tabHouseLight, dark: tabHouseDark },
} as const;

export type IconName = keyof typeof icons;
