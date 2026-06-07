import React, { useState, useEffect } from "react";
import { SubHeading } from "../../components";
import { images } from "../../constants";
import "./Header.css";

const FOOD_IMAGES = [images.welcome, images.thali];

const Header = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsSwapping(true);
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % FOOD_IMAGES.length);
        setIsSwapping(false);
      }, 500);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleFindLocation = () => {
    window.open(
      "https://maps.google.com/?q=Gouthams+Kitchen+Yelahanka+Bangalore",
      "_blank",
    );
  };

  return (
    <>
      <div className="app__header section__padding" id="home">
        <div className="app__wrapper_info">
          <SubHeading title="Chase the new flavour" />
          <h1 className="app__header-h1">Delicious Indian Flavours</h1>
          <p className="p__opensans" style={{ margin: "1rem 0" }}>
            Experience delicious, authentic dishes crafted with fresh
            ingredients right here in Yelahanka. Perfect taste, every single
            time!
          </p>
          <div className="app__header-buttons">
            <button type="button" className="custom__button">
              Explore Menu
            </button>
            <button
              type="button"
              className="custom__button header__findus-btn"
              onClick={handleFindLocation}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-golden)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              Find Us
            </button>
          </div>
        </div>

        <div className="half-plate-wrapper">
          <img
            src={FOOD_IMAGES[currentIndex]}
            alt="header_img"
            className={`half-plate-img ${isSwapping ? "swapping" : ""}`}
          />
        </div>
      </div>

      {/* Separator outside header so it never gets clipped */}
      <div className="app__header-separator">
        <span className="app__header-separator_line" />
        <span className="app__header-separator_diamond" />
        <span className="app__header-separator_line" />
      </div>
    </>
  );
};

export default Header;
