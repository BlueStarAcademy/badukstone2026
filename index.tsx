
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

// 1. Core Styles
import "./styles/variables.css";
import "./styles/base.css";

// 2. UI Component Styles
import "./styles/components.css";

// 3. Feature Specific Styles
import "./styles/student.css";
import "./styles/tournament.css";
import "./styles/mission.css";
import "./styles/shop.css";
import "./styles/event.css";

// Legacy file (kept empty or for overrides)
import "./index.css";

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
