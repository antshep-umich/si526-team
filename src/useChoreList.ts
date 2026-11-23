import { useCallback, useEffect, useRef, useState } from "react";
import { completeChore, listChores, undoChore } from "./api/chores.ts";
import type { Chore } from "./chores.ts";
import { usePolling } from "./usePolling.ts";

// The household's chores as the Chore List and the Schedule show them: loaded from `since`,
// kept current every 10 s, ticked and unticked in place (SCRUM-7, SCRUM-8, SCRUM-73).

export type ChoreListState = { status: "loading" } | { status: "failed" } | { status: "ready"; chores: Chore[] };

export const TOGGLE_FAILED = "Couldn't update this chore. Please try again.";

/** Chores loaded so far win over a reload that started before a tick; new ones are added. */
function keepLocal(current: Chore[], loaded: Chore[]): Chore[] {
  const known = new Set(current.map((chore) => chore.id));
  return [...current, ...loaded.filter((chore) => !known.has(chore.id))];
}

/**
 * `since` ("YYYY-MM-DD") is the first day the screen shows. It only ever moves back: an
 * earlier day loads again (keeping what's shown meanwhile), a later one needs nothing new,
 * since every open chore comes back whatever the date.
 */
export function useChoreList(since: string) {
  const [loadedFrom, setLoadedFrom] = useState(since);
  if (since < loadedFrom) setLoadedFrom(since);

  const [list, setList] = useState<ChoreListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [toggleError, setToggleError] = useState<string | null>(null);
  // Counts ticks and unticks, so a load that started before one can't undo it.
  const changes = useRef(0);
  const savingNow = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = changes.current;
    listChores(loadedFrom).then((result) => {
      if (cancelled) return;
      if (!result.ok) return setList({ status: "failed" });
      const changed = changes.current !== startedAt || savingNow.current > 0;
      setList((current) =>
        changed && current.status === "ready"
          ? { status: "ready", chores: keepLocal(current.chores, result.chores) }
          : { status: "ready", chores: result.chores },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, loadedFrom]);

  // Housemates' changes appear without a refresh. A check that fails, or that started before
  // a tick or untick (or while one is saving), is dropped so it can't undo what the user did.
  usePolling(() => {
    const startedAt = changes.current;
    listChores(loadedFrom).then((result) => {
      if (!result.ok || changes.current !== startedAt || savingNow.current > 0) return;
      setList({ status: "ready", chores: result.chores });
    });
  }, list.status === "ready");

  const replaceChore = useCallback((chore: Chore) => {
    setList((current) =>
      current.status === "ready"
        ? { status: "ready", chores: current.chores.map((c) => (c.id === chore.id ? chore : c)) }
        : current,
    );
  }, []);

  // Ticks or unticks right away, then saves. If saving fails, the checkbox goes back.
  async function toggle(chore: Chore) {
    const undoing = chore.completedAt !== null;
    changes.current += 1;
    savingNow.current += 1;
    setToggleError(null);
    setSaving((ids) => new Set(ids).add(chore.id));
    replaceChore(
      undoing
        ? { ...chore, completedAt: null, completedBy: null }
        : { ...chore, completedAt: new Date().toISOString(), completedBy: chore.assignee },
    );

    const result = await (undoing ? undoChore(chore.id) : completeChore(chore.id));
    changes.current += 1;
    savingNow.current -= 1;
    replaceChore(result.ok ? result.chore : chore);
    if (!result.ok) setToggleError(TOGGLE_FAILED);
    setSaving((ids) => {
      const next = new Set(ids);
      next.delete(chore.id);
      return next;
    });
  }

  function retry() {
    setList({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  return { list, retry, toggle, saving, toggleError };
}
