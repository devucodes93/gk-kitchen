import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import App from "./App";

ReactDOM.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
  document.getElementById("root"),
);

// Register simple service worker for caching static assets
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("Service worker registered.", reg))
      .catch((err) => console.warn("Service worker registration failed:", err));
  });
}

// Scroll reveal: add .reveal class to `.section__padding` elements automatically
// and toggle `.reveal--visible` when they enter the viewport.
if (typeof window !== "undefined" && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal--visible");
        }
      });
    },
    { threshold: 0.12 },
  );

  const applyReveal = () => {
    const els = document.querySelectorAll(".section__padding");
    els.forEach((el, i) => {
      // add base reveal class if not present
      if (!el.classList.contains("reveal")) el.classList.add("reveal");
      // set stagger delay via css variable
      el.style.setProperty("--reveal-delay", `${i * 60}ms`);
      io.observe(el);
    });
  };

  // run after load and also on SPA route changes (basic)
  window.addEventListener("load", applyReveal);
  // for hot reload/dev where load already fired
  setTimeout(applyReveal, 500);
}
