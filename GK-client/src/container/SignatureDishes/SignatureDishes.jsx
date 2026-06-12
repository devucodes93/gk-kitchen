import React, { useState } from "react";
import "./SignatureDishes.css";
import { images } from "../../constants";

const SignatureDishes = () => {
  const [showAll, setShowAll] = useState(false);

  const menuItems = [
    {
      name: "Chicken Fry Piece Biryani (Boneless)",
      desc: "Crispy fried chicken pieces layered into slow-dum basmati. The best of both worlds on one plate.",
      type: "non-veg",
      img: images.bonelss,
      price: 219,
    },
    {
      name: "Mutton Dum Biryani",
      desc: "Tender mutton slow-cooked under a sealed dum with whole spices and fragrant long-grain rice.",
      type: "non-veg",
      img: images.mutton,
      price: 279,
    },
    {
      name: "Karvepaku Chicken",
      desc: "Curry-leaf tossed chicken with a crisp, aromatic finish — a regional favourite done right.",
      type: "non-veg",
      img: images.karivepaku,
      price: 199,
    },
    {
      name: "Chicken Tikka",
      desc: "Marinated overnight and roasted in the tandoor. Juicy inside, lightly charred outside.",
      type: "non-veg",
      img: images.tikka,
      price: 249,
    },
    {
      name: "Paneer Tikka",
      desc: "Cottage cheese marinated in spiced yoghurt, skewered and fired in the tandoor until golden.",
      type: "veg",
      img: images.panner_tikka,
      price: 249,
    },
    {
      name: "Butter Chicken Masala",
      desc: "Slow-simmered chicken in a velvety tomato-butter sauce. Rich, mild, and endlessly satisfying.",
      type: "non-veg",
      img: images.butterchickenmasal,
      price: 209,
    },
  ];

  const extraItems = [
    {
      name: "Chicken Dum Biryani",
      desc: "The classic. Whole-spice dum with bone-in chicken and saffron-tinged basmati.",
      type: "non-veg",
      img: images.biriyani,
      price: 199,
    },
    {
      name: "Gunpowder Chicken",
      desc: "Fiery dry-tossed chicken coated in a bold gunpowder spice blend. Not for the faint-hearted.",
      type: "non-veg",
      img: images.chickenKebab || images.biriyani,
      price: 199,
    },
    {
      name: "Honey Chilli Chicken",
      desc: "Crispy chicken glazed in a sweet-heat honey chilli sauce — an Indo-Chinese crowd-pleaser.",
      type: "non-veg",
      img: images.dragonChicken || images.biriyani,
      price: 239,
    },
    {
      name: "Drums Of Heaven",
      desc: "Crispy chicken winglets tossed in a fiery, sticky sauce. The table empties these fast.",
      type: "non-veg",
      img: images.chickenKebab || images.biriyani,
      price: 269,
    },
    {
      name: "Paneer Butter Masala",
      desc: "Cottage cheese in a rich tomato-butter gravy — the vegetarian answer to butter chicken.",
      type: "veg",
      img: images.paneerTikka || images.biriyani,
      price: 199,
    },
    {
      name: "Kadai Paneer",
      desc: "Paneer and peppers stir-fried in a rustic kadai masala with whole spices and fresh coriander.",
      type: "veg",
      img: images.paneerTikka || images.biriyani,
      price: 189,
    },
    {
      name: "Mushroom Tikka Masala",
      desc: "Tandoor-kissed mushrooms folded into a spiced, creamy masala gravy.",
      type: "veg",
      img: images.mushroomBiryani || images.biriyani,
      price: 169,
    },
    {
      name: "Chicken Tikka Masala",
      desc: "Tandoori chicken pieces finished in a bold, spiced masala — smoky and deeply flavoured.",
      type: "non-veg",
      img: images.chickenTikka || images.biriyani,
      price: 229,
    },
    {
      name: "Gobi Manchurian",
      desc: "Crispy cauliflower florets tossed in a tangy Indo-Chinese sauce with ginger and spring onions.",
      type: "veg",
      img: images.vegManchurian || images.biriyani,
      price: 119,
    },
    {
      name: "Karvepaku Mushroom",
      desc: "Curry-leaf tossed mushrooms with the same bold regional treatment as the chicken version.",
      type: "veg",
      img: images.mushroomBiryani || images.biriyani,
      price: 169,
    },
    {
      name: "Chicken Achari Tikka",
      desc: "Pickle-spiced chicken skewers straight from the tandoor — tangy, smoky and sharp.",
      type: "non-veg",
      img: images.chickenTikka || images.biriyani,
      price: 259,
    },
    {
      name: "Chicken Malai Tikka",
      desc: "Cream-marinated chicken tikka with a sweeter, gentler flavour. Melt-in-the-mouth texture.",
      type: "non-veg",
      img: images.chickenTikka || images.biriyani,
      price: 269,
    },
  ];

  const visibleItems = showAll ? [...menuItems, ...extraItems] : menuItems;

  const handleExploreMenu = () => {
    setShowAll((prev) => !prev);
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

      <div className="app__signature-container">
        {visibleItems.map((item, index) => (
          <div
            className={`signature-card ${
              showAll && index >= menuItems.length ? "signature-card--new" : ""
            }`}
            key={index}
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
    </div>
  );
};

export default SignatureDishes;
