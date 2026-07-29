// Pin the version. Bumping it here is the only upgrade step in this template.
import
{
    configure,
    registerComponents,
} from "https://cdn.jsdelivr.net/npm/ladrillosjs@2.1.0/dist/index.js";

configure({
    onError: (error) =>
    {
        // Replace with your telemetry sink. Framework errors are logged either way.
        console.error("[app]", error.message, error.cause ?? "");
    },
});

await registerComponents({
    "app-header": "./components/app-header.html",
    "hello-card": "./components/hello-card.html",
});
