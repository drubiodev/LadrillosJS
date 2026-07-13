# Error Handling

LadrillosJS development builds report framework problems in a consistent form:

```text
[LadrillosJS] [LJS501] Could not register the component. in <user-card> (user-card.html)
  How to fix: Check the path, serve the app over HTTP, and make sure the server returns HTML.
  Learn more: https://github.com/drubiodev/LadrillosJS/blob/main/docs/21-error-handling.md#ljs501
```

Each diagnostic includes a stable code, the component and source file when
available, a concrete next step, and a link to this reference. The original
JavaScript error is preserved as `cause`.

## Development Builds

Bundlers that honor the `development` package export condition, including
Vite, select the diagnostic build automatically while running in development.
You can select it explicitly when diagnosing an environment that does not:

```js
import { registerComponent } from "ladrillosjs/dev";
```

Use `ladrillosjs/core/dev` for the core-only entry. Production builds remove
development-only warnings and keep coded errors concise.

## Capturing Errors

Use the framework-level handler to send failures to your monitoring service:

```ts
import { configure, LadrillosError } from "ladrillosjs";

configure({
  onError(error, context) {
    if (error instanceof LadrillosError) {
      telemetry.capture(error, {
        code: error.code,
        component: context?.tagName,
        sourcePath: context?.sourcePath,
        docsUrl: error.docsUrl,
      });
    }
  },
});
```

The callback supplements console reporting. An exception thrown by the callback
is contained so that error reporting cannot trigger a recursive framework
failure.

## Error Reference

## LJS101

**Expression evaluation failed.** An otherwise valid template expression threw
while being evaluated. Inspect the original error and verify every value used by
the expression.

## LJS102

**Invalid expression syntax.** Correct the JavaScript syntax in the binding or
directive shown in the diagnostic's code frame.

## LJS103

**Undefined expression variable.** Declare the named value in the component
script or correct the spelling used by the template.

## LJS104

**Null or undefined property access.** Initialize the value before rendering or
guard the access with optional chaining and an appropriate fallback.

## LJS201

**Script extraction failed.** Check that the component's `<script>` block is
valid and correctly closed.

## LJS202

**Script execution failed.** Inspect the original JavaScript error and verify
imports, top-level component code, and browser support.

## LJS301

**Event handler failed.** Check the handler expression shown in the diagnostic
and ensure all referenced state and functions exist.

## LJS401

**Directive failed.** Verify the directive name, required attributes, and
expression syntax.

## LJS402

**Loop failed.** Verify the `<for each="item in items">` expression and ensure
the collection is iterable.

## LJS403

**Conditional failed.** Verify the `<if>` or `<else-if>` expression and values
it reads.

## LJS501

**Component could not be loaded.** Check the reported URL, serve the application
over HTTP rather than `file://`, and make sure the server returns HTML. For a
folder component, provide either the folder path or its `index.html` file.

## LJS502

**Component was not found.** Register the component before loading it and check
that its tag name matches the registration name.

## LJS503

**Component is already registered.** Remove the duplicate registration or use a
different custom element name.

## LJS504

**Invalid component path.** Pass a non-empty URL or relative `.html` path as the
second argument to `registerComponent()`.

## LJS505

**Component registration failed.** Inspect the original error for invalid
template, script, style, or Custom Elements API usage.

## LJS506

**Invalid component name.** Use a lowercase custom element name containing a
hyphen, such as `user-card`.

## LJS601

**Module could not be loaded.** Check the module URL, CORS response, and exported
member names.

## LJS602

**Module execution failed.** Inspect the original error and verify the module is
valid in the browser environment.