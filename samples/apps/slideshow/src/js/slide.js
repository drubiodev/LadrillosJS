const totalSlides = 4;

this.setState({
  currentSlide: 0,
});

const nextSlide = () => {
  this.state.currentSlide = (this.state.currentSlide + 1) % totalSlides;
};

const prevSlide = () => {
  this.state.currentSlide =
    (this.state.currentSlide - 1 + totalSlides) % totalSlides;
};

document.addEventListener("keyup", (event) => {
  if (event.key === "ArrowRight") {
    nextSlide();
  } else if (event.key === "ArrowLeft") {
    prevSlide();
  }
});
