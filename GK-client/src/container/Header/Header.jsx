import React, { useState, useEffect } from "react";
import { SubHeading } from "../../components";
import { images } from "../../constants";
import "./Header.css";

// KEEP ARRAY OUTSIDE COMPONENT: Prevents reference recreating on re-renders, macha!
const FOOD_IMAGES = [images.welcome, images.thali];

const Header = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsSwapping(true); // Fire smooth fade-out instantly

      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % FOOD_IMAGES.length);
        setIsSwapping(false); // Fire smooth fade-in instantly with new image layout
      }, 500); // Perfectly matches CSS transition duration tracking
    }, 10000); // Sets crisp interval loop to run every 10 seconds flat!

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app__header section__padding" id="home">
      <div className="app__wrapper_info">
        <SubHeading title="Chase the new flavour" />
        <h1 className="app__header-h1">Delicious Indian Flavours</h1>
        <p className="p__opensans" style={{ margin: "2rem 0" }}>
          Experience delicious, authentic dishes crafted with fresh ingredients
          right here in Yelahanka. Perfect taste, every single time!
        </p>
        <button type="button" className="custom__button">
          Explore Menu
        </button>
      </div>

      <div className="half-plate-wrapper">
        <img
          src={FOOD_IMAGES[currentIndex]}
          alt="header_img"
          className={`half-plate-img ${isSwapping ? "swapping" : ""}`}
        />
      </div>
    </div>
  );
};

export default Header;
