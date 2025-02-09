import React from "react";
import ReactDOM from "react-dom/client";
import { Amplify } from "aws-amplify";
import { config } from "./amplifyconfiguration";
import App from "./App.tsx";
import "./index.css";
import { generateClient } from "aws-amplify/data";
import outputs from "../amplify_outputs.json";
import type { Schema } from "../amplify/data/resource"; // Path to your backend resource definition

Amplify.configure(outputs);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

const client = generateClient<Schema>();

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
