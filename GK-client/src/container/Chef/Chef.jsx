import React from "react";

import { SubHeading } from "../../components";
import { images } from "../../constants";
import "./Chef.css";

const Chef = () => (
  <div className="app__bg app__wrapper section__padding" id="chefs">
    <div className="app__wrapper_img app__wrapper_img-reverse">
      <img src={images.chef} alt="chef_image" loading="lazy" />
    </div>
    <div className="app__wrapper_info">
      <SubHeading title="About Us" />
      <h1 className="headtext__cormorant">What we believe in</h1>

      <div className="app__chef-content">
        <div className="app__chef-content_quote">
          <img src={images.quote} alt="quote_image" loading="lazy" />
          <p className="p__opensans">From Pharmacy to Restaurant</p>
        </div>
        <p className="p__opensans">
          {" "}
         A journey from healing through medicine to bringing people together through food. Guided by passion, quality, and genuine hospitality, our founder created a place where every meal is prepared with care and every guest is welcomed like family.
        </p>
      </div>

      <div className="app__chef-sign">
        <p>Gautam</p>
        <p className="p__opensans">Founder</p>
       
      </div>
    </div>
  </div>
);

export default Chef;
