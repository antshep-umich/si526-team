import { useEffect, useState, type FormEvent } from "react";
import { userNameMeetsRules } from "../../shared/accounts.ts";
import {
  ASSIGNMENT_METHODS,
  CHORE_TYPES,
  WEEKLY_WORKLOADS,
  type AssignmentMethod,
  type ChorePreferences,
  type ChoreType,
  type WeeklyWorkload,
} from "../../shared/preferences.ts";
import { getCurrentHousehold, type Household } from "../api/households.ts";
import { getChorePreferences, saveAssignmentMethod, saveChorePreferences } from "../api/preferences.ts";
import { authClient } from "../auth.ts";
import Avatar from "../components/Avatar.tsx";
import Button from "../components/Button.tsx";
import PickerField from "../components/PickerField.tsx";
import TextField from "../components/TextField.tsx";
import { useToast } from "../components/Toast.tsx";
import AppearanceSection from "./AppearanceSection.tsx";
import Header from "./Header.tsx";
import LeaveHouseholdSection from "./LeaveHouseholdSection.tsx";
import styles from "./Profile.module.css";
import { FormError } from "./Screen.tsx";

// Your profile (Jira SCRUM-72 User profile page; Figma "User Profile", 637:197): your
// name and email, your chore preferences, how the household assigns chores, light or
// dark mode, and leaving the household (SCRUM-75). Opened from the header menu. Each section saves on its own, with its own Save and Cancel.

/** The story's words for any failed save. */
export const NOT_SAVED = "Changes not saved. Please try again.";

type ProfileProps = {
  household: Household;
  /** The household after a change here (assignment method, or your name in its member list). */
  onHouseholdChange: (household: Household) => void;
};

type Props = ProfileProps & {
  /** After leaving the household (SCRUM-75). */
  onLeft: () => void;
};

export default function Profile({ household, onHouseholdChange, onLeft }: Props) {
  return (
    <main className={styles.page}>
      <Header title={household.name} />
      <ProfileInformation household={household} onHouseholdChange={onHouseholdChange} />
      <ChorePreferencesSection />
      <ManagerPreferencesSection household={household} onHouseholdChange={onHouseholdChange} />
      <AppearanceSection />
      <LeaveHouseholdSection household={household} onLeft={onLeft} />
    </main>
  );
}

function ProfileInformation({ household, onHouseholdChange }: ProfileProps) {
  const { data: session } = authClient.useSession();
  const showToast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const user = session?.user;
  if (!user) return null;

  const startEditing = () => {
    setName(user.name);
    setNameError(null);
    setFormError(null);
    setEditing(true);
  };

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const error = !trimmed ? "Name is required." : userNameMeetsRules(trimmed) ? null : "Name must be 30 characters or fewer.";
    setNameError(error);
    setFormError(null);
    if (error) return;

    setSaving(true);
    try {
      const result = await authClient.updateUser({ name: trimmed });
      if (result.error) {
        const code = result.error.code;
        if (code === "NAME_REQUIRED") setNameError("Name is required.");
        else if (code === "NAME_INVALID") setNameError("Name must be 30 characters or fewer.");
        else setFormError(NOT_SAVED);
        return;
      }
    } catch {
      setFormError(NOT_SAVED);
      return;
    } finally {
      setSaving(false);
    }
    setEditing(false);
    showToast("Profile updated successfully.");
    // Housemates see the new name in the household's member list.
    const refreshed = await getCurrentHousehold();
    if (refreshed.ok) onHouseholdChange(refreshed.household);
  }

  return (
    <section className={styles.section} aria-labelledby="profile-heading">
      <div className={styles.identity}>
        <Avatar name={user.name} />
        <div className={styles.identityText}>
          <h2 id="profile-heading" className={styles.identityTitle}>
            Profile Information
          </h2>
          <p className={styles.role}>{household.role === "owner" ? "Household Owner" : "Household Member"}</p>
        </div>
      </div>

      {editing ? (
        // Not in Figma yet: the edit state. Name becomes a field; email can't change here.
        <form className={styles.form} onSubmit={save} noValidate>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={nameError}
            autoComplete="name"
            autoFocus
          />
          <div className={styles.readOnly}>
            <p className={styles.label}>Email</p>
            <p className={styles.value}>{user.email}</p>
          </div>
          <FormError message={formError} />
          <div className={styles.buttons}>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div>
            <Button variant="outline" onClick={startEditing}>
              Edit Profile
            </Button>
          </div>
          <dl className={styles.details}>
            <div>
              <dt className={styles.label}>Name</dt>
              <dd className={styles.value}>{user.name}</dd>
            </div>
            <div>
              <dt className={styles.label}>Email</dt>
              <dd className={styles.value}>{user.email}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}

type Loaded = { status: "loading" } | { status: "failed" } | { status: "ready"; saved: ChorePreferences };

function ChorePreferencesSection() {
  const showToast = useToast();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [choreTypes, setChoreTypes] = useState<ChoreType[]>([]);
  const [workload, setWorkload] = useState<WeeklyWorkload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const show = (preferences: ChorePreferences) => {
    setChoreTypes(preferences.choreTypes);
    setWorkload(preferences.weeklyWorkload);
  };

  useEffect(() => {
    let cancelled = false;
    getChorePreferences().then((result) => {
      if (cancelled) return;
      if (!result.ok) return setLoaded({ status: "failed" });
      setLoaded({ status: "ready", saved: result.preferences });
      show(result.preferences);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const toggle = (id: ChoreType) =>
    setChoreTypes((chosen) => (chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id]));

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveChorePreferences({ choreTypes, weeklyWorkload: workload });
    setSaving(false);
    if (!result.ok) return setError(NOT_SAVED);
    setLoaded({ status: "ready", saved: result.preferences });
    show(result.preferences);
    // Not in Figma yet: the story asks for "a confirmation message" without its words.
    showToast("Chore preferences saved.");
  }

  return (
    <section className={styles.section} aria-labelledby="chore-preferences-heading">
      <div className={styles.sectionHeader}>
        <h2 id="chore-preferences-heading" className={styles.sectionTitle}>
          Set chore preferences
        </h2>
        <p className={styles.intro}>Choose the chores you would like to be assigned. Select all that apply.</p>
      </div>

      {loaded.status === "loading" && (
        <p className={styles.message} role="status">
          Loading preferences…
        </p>
      )}
      {loaded.status === "failed" && (
        // Not in Figma yet (placeholder): preferences couldn't be loaded.
        <div className={styles.form}>
          <FormError message="Couldn't load your chore preferences." />
          <div>
            <Button
              variant="outline"
              onClick={() => {
                setLoaded({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              Try again
            </Button>
          </div>
        </div>
      )}
      {loaded.status === "ready" && (
        <>
          <div className={styles.choreGrid} role="group" aria-label="Chores you would like">
            {CHORE_TYPES.map((type) => {
              const on = choreTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  type="button"
                  aria-pressed={on}
                  className={`${styles.option} ${styles.choreOption} ${on ? styles.selected : ""}`}
                  onClick={() => toggle(type.id)}
                >
                  {type.label}
                </button>
              );
            })}
          </div>
          <PickerField
            label="Weekly workload"
            placeholder="Choose a workload"
            options={WEEKLY_WORKLOADS.map((w) => ({ value: w.id, label: w.label }))}
            value={workload}
            onChange={(value) => setWorkload(value as WeeklyWorkload)}
          />
          <FormError message={error} />
          <div className={styles.buttons}>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                show(loaded.saved);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function ManagerPreferencesSection({ household, onHouseholdChange }: ProfileProps) {
  const showToast = useToast();
  const [method, setMethod] = useState<AssignmentMethod | null>(household.assignmentMethod);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isOwner = household.role === "owner";

  // Another device (or the polling household) may change it; show what's saved.
  useEffect(() => setMethod(household.assignmentMethod), [household.assignmentMethod]);

  async function save() {
    if (!method) return;
    setSaving(true);
    setError(null);
    const result = await saveAssignmentMethod(method);
    setSaving(false);
    if (!result.ok) return setError(NOT_SAVED);
    onHouseholdChange(result.household);
    // Not in Figma yet: the story asks for "a confirmation message" without its words.
    showToast("Household preferences saved.");
  }

  return (
    <section className={styles.section} aria-labelledby="manager-preferences-heading">
      <div className={styles.sectionHeader}>
        <h2 id="manager-preferences-heading" className={styles.sectionTitle}>
          Set household manager preferences
        </h2>
        <p className={styles.intro}>Control how household chores are assigned and managed.</p>
      </div>
      <div className={styles.methods} role="radiogroup" aria-labelledby="assigned-method-label">
        <p id="assigned-method-label" className={styles.label}>
          Assigned method
        </p>
        {ASSIGNMENT_METHODS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={method === option.id}
            disabled={!isOwner}
            className={`${styles.option} ${styles.methodOption} ${method === option.id ? styles.selected : ""}`}
            onClick={() => setMethod(option.id)}
            aria-label={option.label}
            aria-describedby={`method-${option.id}`}
          >
            <span className={styles.methodName}>{option.label}</span>
            <span id={`method-${option.id}`} className={styles.methodDescription}>
              {option.description}
            </span>
          </button>
        ))}
      </div>
      {isOwner ? (
        <>
          <FormError message={error} />
          <div className={styles.buttons}>
            <Button onClick={save} disabled={saving || !method}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setMethod(household.assignmentMethod);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        // Team decision (README Conflicts): only the owner changes this; others can see it.
        <p className={styles.message}>Only the household owner can change this.</p>
      )}
    </section>
  );
}
