import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { featuredMenu } from "../../constants/menu";
import "./SignatureDishes.css";

const FILTERS = [
  { key: null, label: "All" },
  { key: "biryani", label: "Biryani" },
  { key: "tandoori", label: "Tandoori & Tikka" },
  { key: "curries", label: "Curries & Masalas" },
  { key: "indo-chinese", label: "Indo-Chinese" },
];

const SignatureDishes = () => {
  const [justClicked, setJustClicked] = useState(null);
  const navigate = useNavigate();
  const topItems = featuredMenu.slice(0, 6);

  const handleExploreMenu = () => {
    navigate("/menu");
  };

  const handleFilterClick = (key) => {
    const query = key ? `?category=${encodeURIComponent(key)}` : "";
    navigate(`/menu${query}`);
  };

  const handleItemClick = (item) => {
    setJustClicked(item.name);
   
    setTimeout(() => setJustClicked(null), 200);
  };

  return (
    <div className="app__signature section__padding" id="menu">
      <div className="app__signature-title">
        <p className="p__cormorant">CRAFTED TO PERFECTION</p>
        <h1 className="headtext__cormorant">Signature Dishes</h1>
        <p className="p__opensans text-desc">
          Hyderabadi biriyanis lead the way, then kebabs, curries, and
          Indo-Chinese that earn their own following.
        </p>
      </div>

      <div
        className="signature-filters"
        role="group"
        aria-label="Filter menu by category"
      >
        {FILTERS.map((f) => (
          <button
            type="button"
            key={f.label}
            className="signature-filter-chip"
            onClick={() => handleFilterClick(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="app__signature-container">
        {topItems.map((item) => (
          <div
            className={`signature-card ${justClicked === item.name ? "signature-card--clicked" : ""}`}
            key={item.name}
            role="button"
            tabIndex={0}
            onClick={() => handleItemClick(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") handleItemClick(item);
            }}
          >
            <div className="signature-img-wrapper">
              <img
                src={item.img}
                alt={item.name}
                className="signature-img"
                loading="lazy"
              />
            </div>

            <div className="signature-content">
              <div className="item-title-row">
                <span className={`status-dot ${item.type}`} />
                <h3 className="item-name">{item.name}</h3>
              </div>

              <p className="p__opensans item-desc">{item.desc}</p>

              <div className="item-footer">
                <span className="item-price">₹{item.price}</span>
                <span
                  className={`item-type-label ${
                    item.type === "veg" ? "veg-label" : "nonveg-label"
                  }`}
                >
                  {item.type === "veg" ? "Veg" : "Non-Veg"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="signature-action">
        <button
          type="button"
          className="explore-menu-btn"
          onClick={handleExploreMenu}
        >
          EXPLORE MORE
        </button>
      </div>
    </div>
  );
};

export default SignatureDishes;
