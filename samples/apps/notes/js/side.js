import { registerComponent, $listen, $querySelector } from "ladrillosjs";

// Register components
registerComponent("note-item", "./components/note-item.html");

// Listen to events
$listen("note_saved", (d) => {
  // $querySelector automatically uses the component context!
  const ul = $querySelector("ul");
  console.log(ul);

  if (ul) {
    ul.innerHTML = `<note-item data-note='${JSON.stringify(d)}'></note-item>`;
  }
});
