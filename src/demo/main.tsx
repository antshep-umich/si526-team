import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/tokens.css";
import "../styles/fonts.css";
import "../styles/base.css";
import ComponentsDemo from "./ComponentsDemo.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ComponentsDemo />
  </StrictMode>,
);
