//Entry point for Parcel
//bundler. 
//It imports the main App 
//component and renders it to the DOM.

import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")).render(<App />);