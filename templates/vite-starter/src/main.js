import { configure, registerComponents } from "ladrillosjs";

import "./app.css";

configure({
    onError: (error) =>
    {
        // Replace with your telemetry sink. Framework errors are logged either way.
        console.error("[app]", error.message, error.cause ?? "");
    },
});

// Paths are absolute because components live in public/ — see README.
await registerComponents({
    "app-header": "/components/app-header.html",
    "hello-card": "/components/hello-card.html",
});
