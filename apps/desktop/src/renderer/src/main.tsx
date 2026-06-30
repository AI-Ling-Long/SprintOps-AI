import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { ErrorBoundary } from "./components/feedback/ErrorBoundary";
import "./styles/tokens.css";
import "./styles/global.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("SprintOps renderer root is missing.");

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App bridge={window.sprintOps} />
    </ErrorBoundary>
  </StrictMode>,
);
