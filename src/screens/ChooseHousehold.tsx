import Button from "../components/Button.tsx";
import Screen, { Actions } from "./Screen.tsx";

// SCRUM-4 / SCRUM-5 "Your household" (Figma "iPhone 17 - 3" and "- 7"): shown after
// signing in when the person isn't in a household yet.

type ChooseHouseholdProps = { onCreate: () => void; onJoin: () => void };

export default function ChooseHousehold({ onCreate, onJoin }: ChooseHouseholdProps) {
  return (
    <Screen title="Your household">
      <Actions>
        <Button fullWidth onClick={onCreate}>
          Create a household
        </Button>
        <Button variant="outline" fullWidth onClick={onJoin}>
          Join with a code
        </Button>
      </Actions>
    </Screen>
  );
}
