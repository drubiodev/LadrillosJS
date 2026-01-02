# Element References

The `$ref` directive gives you direct access to DOM elements. Use `$refs.elementName` to interact with elements programmatically.

## Basic Usage

```html
<input type="text" $ref="inputEl" placeholder="Type something..." />
<button onclick="focusInput()">Focus Input</button>

<script>
  function focusInput() {
    $refs.inputEl.focus();
  }
</script>
```

---

## Common Use Cases

### Focus Management

```html
<input type="text" $ref="searchInput" />
<button onclick="$refs.searchInput.focus()">Search</button>
<button onclick="$refs.searchInput.select()">Select All</button>

<script>
  // Focus on component load
  setTimeout(() => $refs.searchInput.focus(), 0);
</script>
```

### Canvas Drawing

```html
<canvas $ref="canvas" width="400" height="300"></canvas>
<button onclick="drawCircle()">Draw Circle</button>
<button onclick="clearCanvas()">Clear</button>

<script>
  function drawCircle() {
    const ctx = $refs.canvas.getContext("2d");
    const x = Math.random() * 400;
    const y = Math.random() * 300;
    const radius = Math.random() * 50 + 10;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 60%)`;
    ctx.fill();
  }

  function clearCanvas() {
    const ctx = $refs.canvas.getContext("2d");
    ctx.clearRect(0, 0, 400, 300);
  }
</script>
```

### Scroll Control

```html
<div $ref="scrollContainer" class="scroll-box">
  <p $for="i in items">Item {i}</p>
</div>

<button onclick="scrollToTop()">↑ Top</button>
<button onclick="scrollToBottom()">↓ Bottom</button>

<script>
  let items = Array.from({ length: 50 }, (_, i) => i + 1);

  function scrollToTop() {
    $refs.scrollContainer.scrollTop = 0;
  }

  function scrollToBottom() {
    const el = $refs.scrollContainer;
    el.scrollTop = el.scrollHeight;
  }
</script>
```

### Video Control

```html
<video $ref="video" src="video.mp4" width="400"></video>

<div class="controls">
  <button onclick="$refs.video.play()">▶ Play</button>
  <button onclick="$refs.video.pause()">⏸ Pause</button>
  <button onclick="$refs.video.currentTime = 0">⏮ Restart</button>
  <button onclick="toggleMute()">🔊 Toggle Mute</button>
</div>

<script>
  function toggleMute() {
    $refs.video.muted = !$refs.video.muted;
  }
</script>
```

---

## Reading Element Properties

```html
<div $ref="box" style="width: 200px; height: 100px; background: lightblue;">
  Resize the window and click the button
</div>

<button onclick="showDimensions()">Show Dimensions</button>
<p>Dimensions: {dimensions}</p>

<script>
  let dimensions = "";

  function showDimensions() {
    const rect = $refs.box.getBoundingClientRect();
    dimensions = `${rect.width}px × ${rect.height}px`;
  }
</script>
```

---

## Form Element Access

```html
<form $ref="form" $on:submit.prevent="handleSubmit()">
  <input name="email" type="email" required />
  <input name="password" type="password" required />
  <button type="submit">Login</button>
</form>

<button onclick="resetForm()">Reset</button>

<script>
  function handleSubmit() {
    const formData = new FormData($refs.form);
    console.log("Email:", formData.get("email"));
    console.log("Password:", formData.get("password"));
  }

  function resetForm() {
    $refs.form.reset();
  }
</script>
```

---

## Multiple Refs

You can have as many refs as needed:

```html
<input $ref="firstName" placeholder="First Name" />
<input $ref="lastName" placeholder="Last Name" />
<input $ref="email" placeholder="Email" />
<input $ref="phone" placeholder="Phone" />

<button onclick="validateAll()">Validate All</button>

<script>
  function validateAll() {
    const fields = [$refs.firstName, $refs.lastName, $refs.email, $refs.phone];

    fields.forEach((field) => {
      if (!field.value.trim()) {
        field.classList.add("error");
      } else {
        field.classList.remove("error");
      }
    });
  }
</script>
```

---

## Integration with Third-Party Libraries

```html
<pre><code $ref="codeBlock" class="language-javascript">
function hello() {
  console.log("Hello, World!");
}
</code></pre>

<script type="module">
  import hljs from "https://esm.sh/highlight.js";

  // Highlight code after component renders
  hljs.highlightElement($refs.codeBlock);
</script>

<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github.min.css"
/>
```

### Chart.js Integration

```html
<canvas $ref="chart" width="400" height="200"></canvas>

<script type="module">
  import Chart from "https://esm.sh/chart.js/auto";

  new Chart($refs.chart, {
    type: "bar",
    data: {
      labels: ["Red", "Blue", "Yellow"],
      datasets: [
        {
          label: "Votes",
          data: [12, 19, 3],
          backgroundColor: ["#ef4444", "#3b82f6", "#eab308"],
        },
      ],
    },
  });
</script>
```

---

## $refs Object

The `$refs` object is a special Map-like object with Proxy support:

```javascript
// Dot notation (preferred)
$refs.inputEl.focus();

// Map methods also work
$refs.get("inputEl").focus();
$refs.has("inputEl"); // true

// Iterate all refs
for (const [name, element] of $refs) {
  console.log(name, element);
}
```

---

## Refs and Timing

Refs are available after the component script runs but before the `ladrillos:ready` event:

```html
<input $ref="myInput" />

<script>
  // ✅ This works - refs are available in script
  console.log($refs.myInput); // <input>

  // ✅ This works too
  function laterAccess() {
    $refs.myInput.focus();
  }
</script>
```

For operations that need the component to be fully rendered:

```html
<script>
  // Wait for component to be fully ready
  $host.addEventListener("ladrillos:ready", () => {
    $refs.myInput.focus();
  });
</script>
```

---

## Refs in Loops

⚠️ **Note:** `$ref` inside `$for` loops will only capture the **last** element:

```html
<!-- ⚠️ Only the last item will be in $refs.item -->
<div $for="item in items" $ref="item">{item}</div>

<!-- ✅ Better: Use unique ref names -->
<div $for="(item, i) in items" $ref="item{i}">{item}</div>

<!-- ✅ Or use a different approach -->
<div $for="item in items" class="item" data-id="{item.id}">{item.name}</div>

<script>
  // Query elements directly
  function getItem(id) {
    return $host.querySelector(`[data-id="${id}"]`);
  }
</script>
```

---

## Special Variables

Inside component scripts, you have access to:

| Variable | Description                   |
| -------- | ----------------------------- |
| `$refs`  | Map of all element references |
| `$host`  | The component element itself  |

```html
<script>
  // Access the component's host element
  $host.classList.add("initialized");
  $host.setAttribute("data-ready", "true");

  // Listen to events on the host
  $host.addEventListener("click", () => {
    console.log("Component clicked");
  });
</script>
```

---

← [Two-Way Binding](./09-two-way-binding.md) | [Visibility Toggle](./11-show.md) →

[Back to Index](./README.md)
