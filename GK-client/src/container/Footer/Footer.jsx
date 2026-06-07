import React, { useState } from "react";
import { FiFacebook, FiTwitter, FiInstagram } from "react-icons/fi";
import { FooterOverlay } from "../../components";
import { images } from "../../constants";
import "./Footer.css";
import { createAccount } from "../../api/api";

const Footer = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    birthday: "",
    favDish: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await createAccount(formData);

      alert("Account Created Successfully!");

      setFormData({
        name: "",
        phone: "",
        birthday: "",
        favDish: "",
      });

      setIsOpen(false);
    } catch (error) {
      console.error(error);

      alert(error.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div
      className="app__footer section__padding"
      id="login"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <FooterOverlay />

      {/* Styled Club Section wrapped with Golden Borders, Macha! */}
      <div
        className="app__footer-newsletter flex__center"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "4rem",
          padding: "2.5rem",
          position: "relative",
          border: "1px solid rgba(220, 202, 135, 0.2)",
          width: "100%",
          maxWidth: "850px",

          margin: "0 auto 4rem auto",
        }}
      >
        {/* Top-left corner */}
        {/* Bottom-right corner */}

        <h1 className="app__footer-headtext">Join the Elite Club</h1>
        <p className="p__opensans">
          Connect with us to unlock premium loyalty offers!
        </p>
        <button
          type="button"
          className="custom__button"
          style={{ marginTop: "1.5rem" }}
          onClick={() => setIsOpen(true)}
        >
          Connect With Us
        </button>
      </div>

      <div className="app__footer-links">
        <div className="app__footer-links_contact">
          <h1 className="app__footer-headtext">Contact Us</h1>
          <p className="p__opensans">
            Near BMSIT College, Yelahanka, Bengaluru, 560064
          </p>
          <p className="p__opensans">+91 98765 43210</p>
        </div>

        <div className="app__footer-links_logo">
          <img src={images.G} alt="footer_logo" loading="lazy" />
          <p className="p__opensans">
            &quot;The best way to find yourself is to lose yourself in the
            service of others.&quot;
          </p>
          <img
            src={images.G}
            className="spoon__img"
            style={{ marginTop: 15 }}
            loading="lazy"
          />
          <div className="app__footer-links_icons">
            <FiFacebook /> <FiTwitter /> <FiInstagram />
          </div>
        </div>

        <div className="app__footer-links_work">
          <h1 className="app__footer-headtext">Working Hours</h1>
          <p className="p__opensans">Mon - Sun:</p>
          <p className="p__opensans">07:00 am - 11:00 pm</p>
        </div>
      </div>

      <div className="footer__copyright" style={{ marginTop: "3rem" }}>
        <p className="p__opensans">
          2026 Goutham's Kitchen. All Rights reserved.
        </p>
      </div>

      {/* Slick Popup Registration Modal View */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "var(--color-black)",
              border: "2px solid var(--color-golden)",
              padding: "3rem 2rem",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "450px",
              position: "relative",
            }}
          >
            <button
              style={{
                position: "absolute",
                top: "15px",
                right: "20px",
                background: "none",
                border: "none",
                color: "var(--color-golden)",
                fontSize: "24px",
                cursor: "pointer",
              }}
              onClick={() => setIsOpen(false)}
            >
              &times;
            </button>
            <h2
              className="headtext__cormorant"
              style={{
                fontSize: "32px",
                marginBottom: "1.5rem",
                textAlign: "center",
                color: "gold",
                textDecoration: "underline",
              }}
            >
              Stay Updated
            </h2>
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1.2rem",
              }}
            >
              <input
                type="text"
                placeholder="Your Full Name"
                required
                style={{
                  background: "none",
                  border: "1px solid var(--color-golden)",
                  padding: "0.6rem 1rem",
                  color: "#fff",
                  outline: "none",
                }}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
              <input
                type="tel"
                placeholder="Phone Number"
                required
                style={{
                  background: "none",
                  border: "1px solid var(--color-golden)",
                  padding: "0.6rem 1rem",
                  color: "#fff",
                  outline: "none",
                }}
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                }}
              >
                <label style={{ color: "var(--color-grey)", fontSize: "12px" }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  style={{
                    background: "none",
                    border: "1px solid var(--color-golden)",
                    padding: "0.6rem 1rem",
                    color: "#fff",
                    outline: "none",
                  }}
                  value={formData.birthday}
                  onChange={(e) =>
                    setFormData({ ...formData, birthday: e.target.value })
                  }
                />
              </div>
              <input
                type="text"
                placeholder="Your Favorite Dish (e.g. Biriyani)"
                style={{
                  background: "none",
                  border: "1px solid var(--color-golden)",
                  padding: "0.6rem 1rem",
                  color: "#fff",
                  outline: "none",
                }}
                value={formData.favDish}
                onChange={(e) =>
                  setFormData({ ...formData, favDish: e.target.value })
                }
              />
              <button
                type="submit"
                className="custom__button"
                style={{ marginTop: "1rem", width: "100%" }}
              >
                Submit Details
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Footer;
