import React from "react";
import "./SignatureDishes.css";
import { images } from "../../constants";
const SignatureDishes = () => {
  const menuItems = [
    {
      name: "Hyderabadi Chicken Biriyani (Boneless)",
      desc: "Our bestseller. Long-grain basmati, slow-dum with boneless chicken, whole spices, crispy onions.",
      type: "non-veg",
      img: images.biriyani, // Your local asset, macha!
    },
    {
      name: "Hyderabadi Veg Biriyani",
      desc: "Fragrant saffron rice layered with seasonal vegetables and the full dum treatment.",
      type: "veg",
      img: images.vegBiryani || images.biriyani, // Falls back to biriyani if specific name isn't in constants
    },
    {
      name: "Hyderabadi Mushroom Biriyani",
      desc: "Earthy button mushrooms slow-cooked in the dum style, a favourite with the vegetarian crowd.",
      type: "veg",
      img: images.mushroomBiryani || images.biriyani,
    },
    {
      name: "Chicken Kebab",
      desc: "Tender, smoky and char-grilled off the tandoor. Pairs perfectly with the mint chutney.",
      type: "non-veg",
      img: images.chickenKebab || images.biriyani,
    },
    {
      name: "Dragon Chicken",
      desc: "Indo-Chinese heat with crispy chicken and a sticky, spicy sauce. A perennial crowd-pleaser.",
      type: "non-veg",
      img: images.dragonChicken || images.biriyani,
    },
    {
      name: "Mutton Keema Balls",
      desc: "Spiced minced mutton shaped and cooked until the outside has a light crust. Order extra.",
      type: "non-veg",
      img: images.muttonKeema || images.biriyani,
    },
  ];
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
        {menuItems.map((item, index) => (
          <div className="signature-card" key={index}>
            <div className="signature-img-wrapper">
              <img src={item.img} alt={item.name} className="signature-img" loading="lazy" />
            </div>
            <div className="signature-content">
              <div className="item-title-row">
                <span className={`status-dot ${item.type}`} />
                <h3 className="item-name">{item.name}</h3>
              </div>
              <p className="p__opensans item-desc">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="signature-action">
        <button type="button" className="explore-menu-btn">
          EXPLORE MENU
        </button>
      </div>
    </div>
  );
};

export default SignatureDishes;
