import {
  registerComponent,
  $listen,
  $emit,
  $querySelector,
  $querySelectorAll,
} from "ladrillosjs";

// ============================================
// 1. Component Registration
// ============================================
console.log("📦 Registering components...");
await registerComponent("simple-counter", "./components/counter.html");
console.log("✅ Components registered!");

// ============================================
// 2. Event Bus Setup
// ============================================
console.log("🎧 Setting up event listeners...");

// Listen to multiple events
$listen("hello", (data) => {
  const logContent = $querySelector("#log-content");
  if (logContent) {
    const entry = document.createElement("div");
    entry.style.color = "#22c55e";
    entry.textContent = `[hello] ${data}`;
    logContent.appendChild(entry);
  }
  console.log("Received hello event:", data);
});

$listen("goodbye", (data) => {
  const logContent = $querySelector("#log-content");
  if (logContent) {
    const entry = document.createElement("div");
    entry.style.color = "#ef4444";
    entry.textContent = `[goodbye] ${data}`;
    logContent.appendChild(entry);
  }
  console.log("Received goodbye event:", data);
});

// Listen to counter updates
$listen("counter_updated", (count) => {
  console.log("Counter updated to:", count);
});

console.log("✅ Event listeners ready!");

// ============================================
// 3. Expose Helper Functions Globally
// ============================================
window.testEmit = (event, message) => {
  $emit(event, message);
};

window.testQuerySelector = () => {
  const buttons = $querySelectorAll("button");
  const result = $querySelector("#query-result");

  if (result) {
    result.innerHTML = `
      <div style="color: #4f46e5;">
        Found <strong>${buttons.length}</strong> buttons on the page using 
        <code>$querySelectorAll("button")</code>
      </div>
    `;
  }
};

// ============================================
// 4. Programmatic Event Emission
// ============================================
setTimeout(() => {
  console.log("🚀 Emitting welcome event from module...");
  $emit("hello", "Welcome! This event was emitted from app.js on page load.");
}, 1000);

console.log("🎉 Module loaded successfully!");
