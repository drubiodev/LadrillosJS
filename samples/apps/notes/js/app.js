const save = () => {
  myNote.id = Date.now();
  $emit("note_saved", myNote).then(() => {
    console.log("saved");
  });
};
