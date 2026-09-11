import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { dismissBootSplash } from "./bootSplash";
import { showBootstrapFatal } from "./bootstrapFatal";
import { setupDevHmrRecovery } from "./devHmrRecovery";
import "./index.css";

setupDevHmrRecovery();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

try {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  dismissBootSplash();
} catch (error) {
  dismissBootSplash();
  const message = error instanceof Error ? error.message : "未知错误";
  showBootstrapFatal(rootEl, message);
  console.error("[bootstrap]", error);
}
