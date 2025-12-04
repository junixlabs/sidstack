import ReactDOM from "react-dom/client";

import App from "./App";
import "./index.css";
import "@xterm/xterm/css/xterm.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // StrictMode temporarily disabled - causes terminal PTY to be killed during init
  // TODO: Fix the effect cleanup to handle StrictMode properly
  <App />,
);
