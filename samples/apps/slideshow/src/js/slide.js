const totalSlides = 3;

this.setState({
  currentSlide: 2,
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
