
import { useEffect, useState } from "react";
import type { HouseholdMember } from "../shared/api.ts";
import { getCurrentHousehold, type Household } from "./api/households.ts";
import { authClient } from "./auth.ts";
import { forgetChoreFilter } from "./choreFilter.ts";
import type { Chore } from "./chores.ts";
import type { TabId } from "./components/TabBar.tsx";
import { ToastProvider, useToast } from "./components/Toast.tsx";
import { forgetInviteCode, pendingInviteCode } from "./inviteLink.ts";
import AddChore from "./screens/AddChore.tsx";
import ChoreHistory from "./screens/ChoreHistory.tsx";
import ChooseHousehold from "./screens/ChooseHousehold.tsx";
import CreateHousehold from "./screens/CreateHousehold.tsx";
import EditChore from "./screens/EditChore.tsx";
import ForgotPassword from "./screens/ForgotPassword.tsx";
import { today as localToday } from "./dates.ts";
import { startingSpot, type ScheduleSpot } from "./schedule.ts";
import Home from "./screens/Home.tsx";
import House from "./screens/House.tsx";
import HouseholdCreated from "./screens/HouseholdCreated.tsx";
import HouseholdChoreHistory from "./screens/HouseholdChoreHistory.tsx";
import HousemateProfile from "./screens/HousemateProfile.tsx";
import Profile from "./screens/Profile.tsx";
import JoinHousehold from "./screens/JoinHousehold.tsx";
import LogIn from "./screens/LogIn.tsx";
import Screen, { Actions, FormError, Loading } from "./screens/Screen.tsx";
import Schedule from "./screens/Schedule.tsx";
import SignUp from "./screens/SignUp.tsx";
import SingleChoreHistory from "./screens/SingleChoreHistory.tsx";
import TabLayout from "./screens/TabLayout.tsx";
import Button from "./components/Button.tsx";
import { useHouseholdNotices } from "./useHouseholdNotices.ts";

// Which screen to show comes from two things: whether someone is signed in
// (Better Auth's session) and whether they belong to a household.

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <Loading />;
  if (!session) return <SignedOut />;
  // key: a different person signing in starts from a clean slate
  return (
    <ToastProvider key={session.user.id}>
      <SignedIn userId={session.user.id} />
    </ToastProvider>
  );
}

function SignedOut() {
  const [screen, setScreen] = useState<"log-in" | "sign-up" | "forgot-password">("log-in");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  if (screen === "sign-up") return <SignUp onLogIn={() => setScreen("log-in")} />;
  if (screen === "forgot-password") {
    return (
      <ForgotPassword
        initialEmail={email}
        onBack={() => setScreen("log-in")}
        onDone={(resetEmail) => {
          setEmail(resetEmail);
          setNotice("Password updated. Log in with your new password.");
          setScreen("log-in");
        }}
      />
    );
  }
  return (
    <LogIn
      key={notice ?? "log-in"} // re-reads initialEmail after a reset
      initialEmail={email}
      notice={notice}
      onSignUp={() => {
        setNotice(null);
        setScreen("sign-up");
      }}
      onForgotPassword={() => {
        setNotice(null);
        setScreen("forgot-password");
      }}
    />
  );
}

type HouseholdState =
  | { status: "loading" }
  | { status: "none" }
  | { status: "failed" }
  | { status: "ready"; household: Household };

/**
 * The screens inside a household: the Schedule, the House tab's two, and the Chores tab's
 * others (profile is under Chores until it has a tab). Edit chore and a chore's history
 * open from the Chore List or the Schedule, and stay under the tab they came from.
 */
type ChoreTab = "chores" | "schedule";
type View =
  | { name: TabId } // each tab's first screen
  | { name: "add-chore" }
  | { name: "my-history" }
  | { name: "household-history" }
  | { name: "edit-chore"; chore: Chore; from: ChoreTab }
  | { name: "chore"; choreId: string; from: ChoreTab }
  | { name: "housemate"; member: HouseholdMember }
  | { name: "profile" };

function SignedIn({ userId }: { userId: string }) {
  const [state, setState] = useState<HouseholdState>({ status: "loading" });
  // An invite link (/join/CODE) opens Join with its code filled in (src/inviteLink.ts).
  const [screen, setScreen] = useState<"choose" | "create" | "join">(() => (pendingInviteCode() ? "join" : "choose"));
  const [view, setView] = useState<View>({ name: "chores" });
  // Where the Schedule is (Week or Month, the selected day), kept while its chores are open.
  const [scheduleSpot, setScheduleSpot] = useState<ScheduleSpot>(() => startingSpot(localToday()));
  const [justCreated, setJustCreated] = useState<Household | null>(null);
  const [attempt, setAttempt] = useState(0);
  const showToast = useToast();

  // Someone already in a household can't use an invite link, so it's dropped.
  useEffect(() => {
    if (state.status === "ready") forgetInviteCode();
  }, [state.status]);

  useEffect(() => {
    let cancelled = false;
    getCurrentHousehold().then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ status: "ready", household: result.household });
      else setState({ status: result.code === "NO_HOUSEHOLD" ? "none" : "failed" });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Back to "Your household": after leaving (SCRUM-75 AC3), or on finding you're no longer in one.
  const leftHousehold = () => {
    forgetChoreFilter();
    setView({ name: "chores" });
    setScreen("choose");
    setState({ status: "none" });
  };

  // SCRUM-75 AC8: "[Name] left the household." for those still in it.
  useHouseholdNotices({
    enabled: state.status === "ready",
    onHouseholdChange: () => {
      getCurrentHousehold().then((result) => {
        if (result.ok) setState({ status: "ready", household: result.household });
      });
    },
    onNoHousehold: leftHousehold,
  });

  const logOut = () => {
    forgetChoreFilter();
    forgetInviteCode();
    return authClient.signOut();
  };

  if (justCreated) {
    return (
      <HouseholdCreated
        household={justCreated}
        userId={userId}
        onContinue={() => {
          setState({ status: "ready", household: justCreated });
          setJustCreated(null);
        }}
      />
    );
  }

  if (state.status === "loading") return <Loading />;

  // Not designed yet (placeholder): the household couldn't be loaded.
  if (state.status === "failed") {
    return (
      <Screen title="Something went wrong">
        <FormError message="Couldn't load your household. Check your connection and try again." />
        <Actions>
          <Button
            fullWidth
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
          <Button variant="outline" fullWidth onClick={logOut}>
            Log out
          </Button>
        </Actions>
      </Screen>
    );
  }

  if (state.status === "ready") {
    const household = state.household;
    const showChores = () => setView({ name: "chores" });
    const backTo = (from: ChoreTab) => () => setView({ name: from });
    const openChoreFrom = (from: ChoreTab) => ({
      onEditChore: (chore: Chore) => setView({ name: "edit-chore", chore, from }),
      onOpenChore: (choreId: string) => setView({ name: "chore", choreId, from }),
    });
    let content;
    switch (view.name) {
      case "add-chore":
        content = <AddChore household={household} userId={userId} onAdded={showChores} onCancel={showChores} />;
        break;
      case "my-history":
        content = <ChoreHistory household={household} userId={userId} />;
        break;
      case "household-history":
        content = <HouseholdChoreHistory household={household} userId={userId} />;
        break;
      case "edit-chore":
        content = (
          <EditChore
            household={household}
            userId={userId}
            chore={view.chore}
            onSaved={backTo(view.from)}
            onCancel={backTo(view.from)}
          />
        );
        break;
      case "chore":
        content = <SingleChoreHistory choreId={view.choreId} userId={userId} />;
        break;
      case "schedule":
        content = (
          <Schedule
            household={household}
            userId={userId}
            spot={scheduleSpot}
            onSpotChange={setScheduleSpot}
            {...openChoreFrom("schedule")}
          />
        );
        break;
      case "house":
        content = <House userId={userId} onOpenHousemate={(member) => setView({ name: "housemate", member })} />;
        break;
      case "housemate":
        content = <HousemateProfile member={view.member} />;
        break;
      case "profile":
        content = (
          <Profile
            household={household}
            onHouseholdChange={(next) => setState({ status: "ready", household: next })}
            onLeft={leftHousehold}
          />
        );
        break;
      case "chores":
        content = (
          <Home
            household={household}
            userId={userId}
            onAddChore={() => setView({ name: "add-chore" })}
            {...openChoreFrom("chores")}
          />
        );
        break;
    }
    const menu = {
      onChoreHistory: () => setView({ name: "my-history" }),
      onHouseholdChoreHistory: () => setView({ name: "household-history" }),
      onProfile: () => setView({ name: "profile" }),
      onLogOut: logOut,
    };
    const tab: TabId =
      view.name === "house" || view.name === "housemate"
        ? "house"
        : view.name === "schedule" || ((view.name === "edit-chore" || view.name === "chore") && view.from === "schedule")
          ? "schedule"
          : "chores";
    // Each tab opens its first screen; the Schedule, its current week with today selected.
    const selectTab = (next: TabId) => {
      if (next === "schedule") setScheduleSpot(startingSpot(localToday()));
      setView({ name: next });
    };
    return (
      <TabLayout
        selected={tab}
        onSelect={selectTab}
        menu={menu}
        screen={view}
      >
        {content}
      </TabLayout>
    );
  }

  if (screen === "create") {
    return <CreateHousehold onCreated={setJustCreated} onBack={() => setScreen("choose")} />;
  }
  if (screen === "join") {
    return (
      <JoinHousehold
        initialCode={pendingInviteCode() ?? ""}
        onJoined={(household) => {
          forgetInviteCode();
          setState({ status: "ready", household });
          showToast(`You joined ${household.name}.`); // SCRUM-32 AC3
        }}
        onBack={() => {
          forgetInviteCode();
          setScreen("choose");
        }}
      />
    );
  }
  return <ChooseHousehold onCreate={() => setScreen("create")} onJoin={() => setScreen("join")} />;
}
