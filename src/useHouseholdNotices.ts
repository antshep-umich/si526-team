import { useEffect, useRef } from "react";
import { getNotices, markNoticesSeen, type HouseholdNotice } from "./api/notices.ts";
import { useToast } from "./components/Toast.tsx";
import { usePolling } from "./usePolling.ts";

/** What a notice says (SCRUM-75 AC8's words). */
export function noticeMessage(notice: HouseholdNotice): string {
  return `${notice.personName} left the household.`;
}

type Options = {
  /** Only while the user is in a household. */
  enabled: boolean;
  /** After a notice: the household changed (someone left), so reload it. */
  onHouseholdChange: () => void;
  /** The user isn't in a household any more (they left on another device). */
  onNoHousehold: () => void;
};

/**
 * Household notices (SCRUM-75 AC8): checks when the app opens and every 10 seconds after
 * (usePolling), shows the unseen ones as a toast, then marks them seen so each shows once.
 * Not in Figma yet: the toast is the placeholder for notifications (README Conflicts row 9).
 */
export function useHouseholdNotices({ enabled, onHouseholdChange, onNoHousehold }: Options) {
  const showToast = useToast();
  const checking = useRef(false);
  const latest = useRef({ onHouseholdChange, onNoHousehold });
  useEffect(() => {
    latest.current = { onHouseholdChange, onNoHousehold };
  });

  const check = async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      const result = await getNotices();
      if (!result.ok) {
        if (result.code === "NO_HOUSEHOLD") latest.current.onNoHousehold();
        return;
      }
      if (result.notices.length === 0) return;
      // One toast at a time (Toast.tsx), so several notices share it.
      showToast(result.notices.map(noticeMessage).join(" "));
      await markNoticesSeen(result.notices.at(-1)!.createdAt);
      latest.current.onHouseholdChange();
    } finally {
      checking.current = false;
    }
  };

  useEffect(() => {
    if (enabled) check();
  }, [enabled]); // once each time the user is in a household

  usePolling(check, enabled);
}
