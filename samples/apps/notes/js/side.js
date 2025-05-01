import { notesStore } from "../stores/notesStore.js";

export default function () {
  const ul = this.querySelector("ul");

  // whenever the store changes, rewrite the UL’s innerHTML
  const unsubscribe = notesStore.subscribe(({ notes }) => {
    ul.innerHTML = notes.map((n) => `<li>${n.title}</li>`).join("");
  });

  // remember to call unsubscribe() in disconnectedCallback if you tear down
}
