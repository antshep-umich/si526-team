import { useEffect, useState } from "react";
import type { ApiError, HealthResponse } from "../shared/api.ts";

type Check =
  | { state: "checking" }
  | { state: "ok"; body: HealthResponse }
  | { state: "failed"; reason: string };

async function checkHealth(): Promise<Check> {
  try {
    const res = await fetch("/api/health");
    if (res.ok) return { state: "ok", body: (await res.json()) as HealthResponse };
    const body = (await res.json().catch(() => null)) as ApiError | null;
    return { state: "failed", reason: body?.error.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { state: "failed", reason: err instanceof Error ? err.message : String(err) };
  }
}

export default function App() {
  const [check, setCheck] = useState<Check>({ state: "checking" });

  useEffect(() => {
    checkHealth().then(setCheck);
  }, []);

  return (
    <main>
      <h1>JAALS Chore Tracker</h1>
      <p>
        {check.state === "checking" && "Checking the API…"}
        {check.state === "ok" && `API: ok · Database: ${check.body.database}`}
        {check.state === "failed" && `API check failed: ${check.reason}`}
      </p>
    </main>
  );
}
