import { notesStore } from "../stores/notesStore.js";

export default function () {
  const ul = this.querySelector("ul");

  notesStore.subscribe(({ notes }) => {
    ul.innerHTML = notes.map((n) => `<li>${n.title}</li>`).join("");
  });
}
