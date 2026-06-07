import React from "react";

import {
  
  Chef,
  FindUs,
  Footer,
  Gallery,
  Header,
  Intro,
  Laurels,
  SpecialMenu,
} from "./container";
import { Navbar } from "./components";
import "./App.css";
import WhyChooseUs from "./container/WhyChooseUs/WhyChooseUs";
import SignatureDishes from "./container/SignatureDishes/SignatureDishes";

const App = () => (
  <div>
    <Navbar />
    <Header />
    <WhyChooseUs />
    <SignatureDishes />

    <Chef />
    <Intro />
  
    <Gallery />
    <FindUs />
    <Footer />
  </div>
);

export default App;
