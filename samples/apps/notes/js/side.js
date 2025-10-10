import { registerComponent, $listen, $querySelector } from "ladrillosjs";

const notes = [];
// Register components
registerComponent("note-item", "./components/note-item.html");

// Listen to events
$listen("note_saved", (d) => {
  notes.push({ ...d });

  const ul = $querySelector("ul");

  if (ul) {
    ul.innerHTML = notes
      .map((n) => `<note-item data-note='${JSON.stringify(n)}'></note-item>`)
      .join("");
  }
});
