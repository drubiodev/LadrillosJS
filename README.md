# LadrillosJS

<img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.png" alt="LadrillosJS" width="400"/>

A lightweight, zero-dependency web component framework for building modular web applications.

## Getting Starting with samples

1. `npm install`
2. `npm run dev`

## Usage

### 1. Install & import

```bash
npm install ladrillosjs
```

#### cdn

```js
<script src="https://cdn.jsdelivr.net/npm/ladrillosjs@0.1.1"></script>
 <script type="module">
      ladrillosjs.ladrillos.registerComponent(
        "alert-button",
        "alert-button.html"
      );
    </script>
```

### 2. Create index.html file

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Hello World</title>
    <style>
      :root {
        --btn-bg: #1a73e8;
        --btn-color: #ffffff;
        --btn-padding: 0.75rem 1.5rem;
        --btn-radius: 0.375rem;
        --btn-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        --btn-hover-bg: #1669c1;
        --btn-transition: background-color 0.2s ease, transform 0.2s ease,
          box-shadow 0.2s ease;
      }
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        margin: 0;
      }
    </style>
  </head>
  <body>
    <!-- Add component -->
    <alert-button></alert-button>
    <script type="module">
      // import framework
      import { ladrillos } from "ladrillosjs";
      // register component (name, location)
      ladrillos.registerComponent("alert-button", "alert-button.html");
    </script>
  </body>
</html>
```

### 3. Create a component

Create `alert-button.html`

```html
<style>
  button {
    background: var(--btn-bg);
    color: var(--btn-color);
    padding: var(--btn-padding);
    border: none;
    border-radius: var(--btn-radius);
    box-shadow: var(--btn-shadow);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: var(--btn-transition);
  }

  button:hover {
    background: var(--btn-hover-bg);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.12);
  }

  button:active {
    transform: translateY(0);
    box-shadow: var(--btn-shadow);
    opacity: 0.9;
  }

  button:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.4);
  }
</style>
<button onclick="{increaseCount()}">Clicked: {count}</button>

<script>
  const count = 0;

  const increaseCount = () => {
    count++;

    if (count >= 10) {
      alert("to many clicks");
    }
  };
</script>
```
