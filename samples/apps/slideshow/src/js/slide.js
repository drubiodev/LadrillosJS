const totalSlides = 4;

$setState({
  currentSlide: 0,
});

const nextSlide = () => {
  console.log("nextSlide");
  $state.currentSlide = ($state.currentSlide + 1) % totalSlides;
  console.log($state);
};

const prevSlide = () => {
  $state.currentSlide = ($state.currentSlide - 1 + totalSlides) % totalSlides;
};

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowRight") {
    nextSlide();
  } else if (event.key === "ArrowLeft") {
    prevSlide();
  }
});
