# LadrillosJS

<img src="https://raw.githubusercontent.com/drubiodev/LadrillosJS/refs/heads/main/LadrillosJS.png" alt="LadrillosJS" width="400"/>

A lightweight, zero-dependency web component framework for building modular web applications.

"I designed this framework to empower developers with the ability to componentize their code efficiently and effectively, without the need for a full-scale framework. By focusing on simplicity and leveraging core web fundamentals, my goal was to create a lightweight and accessible solution that enhances development while staying true to the basics."

## Getting Starting with samples

1. `npm install`
2. `npm run dev`

## Usage

### Install & import

```bash
npm install ladrillosjs
```

### cdn

```js
<script defer src="https://cdn.jsdelivr.net/npm/ladrillosjs"></script>
```

## First Component

A component in LadrillosJS is a reusable custom HTML element that bundles its own template, logic (bindings) and styles into a single file.

To create your first component, follow these steps:

1. Create an HTML file that defines your component’s template, script bindings and CSS. For example:

   ```html
   <!-- filepath: samples/hello.html -->

   <p>Hello, LadrillosJS!</p>
   <button onclick="increment">Clicked {count} times</button>

   <script>
     // declare a bound variable
     let count = 0;

     // declare a handler for the button click
     const increment = () => {
       count++;
       // update component state and re-render
       this.setState({ count });
     };
   </script>

   <style>
     p {
       font-size: 1.25rem;
       color: #1a73e8;
     }
     button {
       margin-top: 0.5rem;
       padding: 0.5rem 1rem;
     }
   </style>
   ```

2. Import and register your component in the page where you want to use it:

   ```html
   <!-- import -->
   <script type="module">
     import { registerComponent } from "ladrillosjs";

     registerComponent("hello-world", "hello-world.html");
   </script>

   <!-- CDN -->
   <script type="module">
     ladrillosjs.registerComponent("hello-world", "hello-world.html");
   </script>
   ```

   ```html
   <!-- then use it in markup -->
   <hello-world></hello-world>
   ```
