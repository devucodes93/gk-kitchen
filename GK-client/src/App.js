import React from "react";
import { Routes, Route } from "react-router-dom";

import {
  Chef,
  FindUs,
  Footer,
  Gallery,
  Header,
  Intro,
} from "./container";

import { Navbar } from "./components";

import WhyChooseUs from "./container/WhyChooseUs/WhyChooseUs";
import SignatureDishes from "./container/SignatureDishes/SignatureDishes";

import AuthSuccess from "./Pages/AuthSuccess";

import "./App.css";

function HomePage() {
  return (
    <>
      <Navbar />
      <Header />
      <WhyChooseUs />
      <SignatureDishes />
      <Chef />
      <Intro />
      <Gallery />
      <FindUs />
      <Footer />
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/auth-success"
        element={<AuthSuccess />}
      />
    </Routes>
  );
}

export default App;