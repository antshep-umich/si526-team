import { useEffect, useState } from "react";
import { getCurrentHousehold, type Household } from "./api/households.ts";
import { authClient } from "./auth.ts";
import AddChore from "./screens/AddChore.tsx";
import ChooseHousehold from "./screens/ChooseHousehold.tsx";
import CreateHousehold from "./screens/CreateHousehold.tsx";
import ForgotPassword from "./screens/ForgotPassword.tsx";
import Home, { forgetChoreFilter } from "./screens/Home.tsx";
import HouseholdCreated from "./screens/HouseholdCreated.tsx";
import JoinHousehold from "./screens/JoinHousehold.tsx";
import LogIn from "./screens/LogIn.tsx";
import Screen, { Actions, FormError, Loading } from "./screens/Screen.tsx";
import SignUp from "./screens/SignUp.tsx";
import Button from "./components/Button.tsx";

// Which screen to show comes from two things: whether someone is signed in
// (Better Auth's session) and whether they belong to a household.

export default function App() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <Loading />;
  if (!session) return <SignedOut />;
  // key: a different person signing in starts from a clean slate
  return <SignedIn key={session.user.id} userId={session.user.id} />;
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

function SignedIn({ userId }: { userId: string }) {
  const [state, setState] = useState<HouseholdState>({ status: "loading" });
  const [screen, setScreen] = useState<"choose" | "create" | "join">("choose");
  const [addingChore, setAddingChore] = useState(false);
  const [justCreated, setJustCreated] = useState<Household | null>(null);
  const [attempt, setAttempt] = useState(0);

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

  const logOut = () => {
    forgetChoreFilter();
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
    if (addingChore) {
      return (
        <AddChore
          household={state.household}
          userId={userId}
          onAdded={() => setAddingChore(false)}
          onCancel={() => setAddingChore(false)}
        />
      );
    }
    return (
      <Home
        household={state.household}
        userId={userId}
        onAddChore={() => setAddingChore(true)}
        onLogOut={logOut}
      />
    );
  }

  if (screen === "create") {
    return <CreateHousehold onCreated={setJustCreated} onBack={() => setScreen("choose")} />;
  }
  if (screen === "join") {
    return (
      <JoinHousehold
        onJoined={(household) => setState({ status: "ready", household })}
        onBack={() => setScreen("choose")}
      />
    );
  }
  return <ChooseHousehold onCreate={() => setScreen("create")} onJoin={() => setScreen("join")} />;
}
