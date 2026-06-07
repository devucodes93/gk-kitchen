import React from "react";
import ReactDOM from "react-dom";

import "./index.css";
import App from "./App";

ReactDOM.render(<App />, document.getElementById("root"));

// Register simple service worker for caching static assets
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/service-worker.js')
			.then((reg) => console.log('Service worker registered.', reg))
			.catch((err) => console.warn('Service worker registration failed:', err));
	});
}
