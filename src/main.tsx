import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import { config } from "./amplifyconfiguration";
import App from "./App.tsx";
import "./index.css";

Amplify.configure(config);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
