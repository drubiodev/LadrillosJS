const save = () => {
  console.log("Note saved!", myNote);
  $emit("note_saved", myNote).then(() => {
    console.log("saved");
  });
};
