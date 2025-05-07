import { notesStore } from "../stores/notesStore.js";
import { registerComponent } from "ladrillosjs";

registerComponent("note-item", "./components/note-item.html");

export default function () {
  const ul = this.querySelector("ul");

  notesStore.subscribe(({ notes }) => {
    ul.innerHTML = notes
      .map((n) => `<note-item data-note='${JSON.stringify(n)}'></note-item>`)
      .join("");
  });
}
