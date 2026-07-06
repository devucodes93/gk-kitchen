import React, { useState, useEffect } from "react";
import "./SignatureDishes.css";
import { featuredMenu, extraMenu } from "../../constants/menu";
import OrderScreen from "../../Pages/orderScreen/OrderScreen";

const FILTERS = [
  { key: null, label: "All" },
  { key: "biryani", label: "Biryani" },
  { key: "tandoori", label: "Tandoori & Tikka" },
  { key: "curries", label: "Curries & Masalas" },
  { key: "indo-chinese", label: "Indo-Chinese" },
];

const SignatureDishes = () => {
  const [showAll, setShowAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [justClicked, setJustClicked] = useState(null);
  const [orderItem, setOrderItem] = useState(null);

  const menuItems = featuredMenu;
  const extraItems = extraMenu;

  // Listen for the "menu:jump" event fired by the hero/intro section so a
  // category click there actually filters this grid, not just scrolls to it.
  useEffect(() => {
    const onJump = (e) => {
      const category = e.detail?.category ?? null;
      setActiveFilter(category);
      if (category) setShowAll(true); // some categories only exist in extraItems
    };
    window.addEventListener("menu:jump", onJump);
    return () => window.removeEventListener("menu:jump", onJump);
  }, []);

  const allItems = showAll ? [...menuItems, ...extraItems] : menuItems;
  const visibleItems = activeFilter
    ? allItems.filter((item) => item.category === activeFilter)
    : allItems;

  const handleExploreMenu = () => {
    setShowAll((prev) => !prev);
  };

  const handleFilterClick = (key) => {
    setActiveFilter(key);
    if (key) setShowAll(true);
  };

  // Clicking a dish: flash a quick highlight, then open the order screen
  // where quantity, payment method and delivery location get chosen.
  const handleItemClick = (item) => {
    setJustClicked(item.name);
    window.dispatchEvent(new CustomEvent("order:item", { detail: item }));
    setTimeout(() => {
      setJustClicked(null);
      setOrderItem(item);
    }, 200);
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
            className={`signature-filter-chip ${
              activeFilter === f.key ? "signature-filter-chip--active" : ""
            }`}
            onClick={() => handleFilterClick(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="app__signature-container">
        {visibleItems.map((item, index) => (
          <div
            className={`signature-card ${
              showAll && index >= menuItems.length ? "signature-card--new" : ""
            } ${justClicked === item.name ? "signature-card--clicked" : ""}`}
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
              {/* <div className="price-badge">₹{item.price}</div> */}
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
          {showAll ? "SHOW LESS" : "EXPLORE MENU"}
        </button>
      </div>

      {orderItem && (
        <OrderScreen item={orderItem} onClose={() => setOrderItem(null)} />
      )}
    </div>
  );
};

export default SignatureDishes;
