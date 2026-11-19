import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/base.css";
import App from "./App.tsx";
import { takeInviteCodeFromAddress } from "./inviteLink.ts";
import { applyTheme, savedTheme } from "./theme.ts";

// Before the first paint, so a chosen light or dark mode never flashes the other one.
applyTheme(savedTheme());
takeInviteCodeFromAddress();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
