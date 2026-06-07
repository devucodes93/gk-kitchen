import React, { useState, useEffect, useRef } from "react";
import "./WhyChooseUs.css";

const WhyChooseUs = () => {
  const cards = [
    {
      title: "Uncompromised Quality",
      desc: "No artificial colors, no shortcuts, and zero compromise. Every single ingredient undergoes absolute quality checks to ensure you get pure, clean, and healthy food.",
      img: "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&auto=format&fit=crop&q=60",
    },
    {
      title: "Pharmacy-Grade Hygiene",
      desc: "Our founder brings years of pharmaceutical expertise to the kitchen. We maintain strict clinical standards of sanitation and safety, because your health comes first.",
      img: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=60",
    },
    {
      title: "Traditional Slow Cooking",
      desc: "We respect the art of flavor. Our dishes are slow-cooked using authentic, time-tested methods to perfectly lock in the deep, rich aromas of traditional Indian spices.",
      img: "https://images.unsplash.com/photo-1547825407-2d060104b7f8?w=600&auto=format&fit=crop&q=60",
    },
    {
      title: "Premium Taste, Honest Pricing",
      desc: "Great food shouldn't burn a hole in your pocket. We bring you elite, uncompromised restaurant quality right here in Yelahanka at a price that makes you happy.",
      img: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=600&auto=format&fit=crop&q=60",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const timeoutRef = useRef(null);

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  // Auto-slide effect for mobile screens
  useEffect(() => {
    resetTimeout();
    timeoutRef.current = setTimeout(
      () =>
        setCurrentIndex((prevIndex) =>
          prevIndex === cards.length - 1 ? 0 : prevIndex + 1,
        ),
      4000, // Slides every 4 seconds
    );

    return () => {
      resetTimeout();
    };
  }, [currentIndex]);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev === cards.length - 1 ? 0 : prev + 1));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev === 0 ? cards.length - 1 : prev - 1));
  };

  return (
    <div className="app__whychooseus section__padding" id="why-us">
      <div className="app__whychooseus-title">
        <h1 className="headtext__cormorant">Why Gautam's Kitchen?</h1>
        <p className="p__opensans">
          Authentic flavors, clinical hygiene, and absolute honesty in every
          plate.
        </p>
      </div>

      {/* Desktop Grid Layout */}
      <div className="app__whychooseus-container desktop-grid">
        {cards.map((card, index) => (
          <div
            className="whychooseus-card"
            key={index}
            style={{ "--card-bg": `url(${card.img})` }}
          >
            <div className="card-accent-line" />
            <h3 className="card-title">{card.title}</h3>
            <p className="p__opensans card-desc">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* Mobile Carousel Layout */}
      <div className="mobile-carousel-wrapper">
        <button className="carousel-btn prev" onClick={prevSlide}>
          &#10094;
        </button>

        <div className="mobile-carousel-slider">
          <div
            className="mobile-carousel-track"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {cards.map((card, index) => (
              <div
                className={`whychooseus-card mobile-card ${currentIndex === index ? "active-slide" : ""}`}
                key={index}
                style={{ "--card-bg": `url(${card.img})` }}
              >
                <div className="card-accent-line" />
                <h3 className="card-title">{card.title}</h3>
                <p className="p__opensans card-desc">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <button className="carousel-btn next" onClick={nextSlide}>
          &#10095;
        </button>

        {/* Dots Indicator */}
        <div className="carousel-dots">
          {cards.map((_, idx) => (
            <div
              key={idx}
              className={`dot ${currentIndex === idx ? "active" : ""}`}
              onClick={() => setCurrentIndex(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WhyChooseUs;
