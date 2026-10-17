// Icons exported from Figma (Components page). Their colors are drawn into each file,
// so every icon has a light-mode and a dark-mode version. Use them through ThemedIcon.
import alertDark from "../assets/icons/dark/alert.svg";
import checkDark from "../assets/icons/dark/check.svg";
import checkboxOverdueDark from "../assets/icons/dark/checkbox-overdue.svg";
import checkboxPendingDark from "../assets/icons/dark/checkbox-pending.svg";
import clockDark from "../assets/icons/dark/clock.svg";
import tabChoresActiveDark from "../assets/icons/dark/tab-chores-active.svg";
import tabChoresDark from "../assets/icons/dark/tab-chores.svg";
import tabHouseActiveDark from "../assets/icons/dark/tab-house-active.svg";
import tabHouseDark from "../assets/icons/dark/tab-house.svg";
import tabScheduleActiveDark from "../assets/icons/dark/tab-schedule-active.svg";
import tabScheduleDark from "../assets/icons/dark/tab-schedule.svg";
import alertLight from "../assets/icons/light/alert.svg";
import checkLight from "../assets/icons/light/check.svg";
import checkboxOverdueLight from "../assets/icons/light/checkbox-overdue.svg";
import checkboxPendingLight from "../assets/icons/light/checkbox-pending.svg";
import clockLight from "../assets/icons/light/clock.svg";
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
