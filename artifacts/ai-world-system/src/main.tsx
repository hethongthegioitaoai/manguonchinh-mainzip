import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <div className="dark min-h-screen">
    <App />
  </div>
);
