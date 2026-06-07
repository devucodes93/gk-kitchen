import React from "react";
import { SubHeading } from "../../components";
import { images } from "../../constants";

const FindUs = () => {
  // Direct navigation link to Goutham's Kitchen in Yelahanka, macha!
  const handleMapRedirect = () => {
    window.open(
      "https://maps.google.com/?q=Gouthams+Kitchen+Yelahanka+Bangalore",
      "_blank",
    );
  };

  return (
    <div className="app__bg app__wrapper section__padding" id="contact">
      <div className="">
        <SubHeading title="Contact" />
        <h1 className="headtext__cormorant" style={{ marginBottom: "3rem" }}>
          Find Us
        </h1>
        <div className="app__wrapper-content">
          <p
            className="p__opensans"
            style={{ color: "var(--color-white)", fontWeight: "600" }}
          >
            Goutham's Kitchen, Near BMSIT College, Yelahanka, Bengaluru,
            Karnataka 560064
          </p>
          <p
            className="p__cormorant"
            style={{ color: "#DCCA87", margin: "2rem 0" }}
          >
            Opening Hours
          </p>
          <p className="p__opensans">Mon - Sun: 07:00 am - 11:00 pm</p>
        </div>
        <button
          type="button"
          className="custom__button"
          style={{ marginTop: "2rem" }}
          onClick={handleMapRedirect}
        >
          Visit Us
        </button>
      </div>

      <div
        className="app__wrapper_img"
        style={{ position: "relative", padding: "12px 0" }}
      >
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "40px",
            height: "40px",
            borderTop: "5px solid var(--color-golden)",
            borderLeft: "5px solid var(--color-golden)",
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: "40px",
            height: "40px",
            borderBottom: "5px solid var(--color-golden)",
            borderRight: "5px solid var(--color-golden)",
          }}
        />
        <img
          src={images.contact}
          alt="findus_img"
          style={{ paddingTop: "20px" }}
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default FindUs;
