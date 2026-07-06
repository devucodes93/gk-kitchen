import React, { useEffect, useState } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import { Chef, FindUs, Footer, Gallery, Header, Intro } from "./container";

import { Navbar } from "./components";

import WhyChooseUs from "./container/WhyChooseUs/WhyChooseUs";
import SignatureDishes from "./container/SignatureDishes/SignatureDishes";

import AuthSuccess from "./Pages/AuthSuccess";
import MenuPage from "./Pages/MenuPage";
import CheckoutPage from "./Pages/CheckoutPage";
import WhatsAppButton from "./components/Whatsapp/WhatsAppButton";

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
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleCheckoutOpen = () => setCheckoutOpen(true);
    const handleCheckoutClose = () => setCheckoutOpen(false);

    window.addEventListener("checkout:open", handleCheckoutOpen);
    window.addEventListener("checkout:close", handleCheckoutClose);

    return () => {
      window.removeEventListener("checkout:open", handleCheckoutOpen);
      window.removeEventListener("checkout:close", handleCheckoutClose);
    };
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/auth-success" element={<AuthSuccess />} />
      </Routes>
      {!checkoutOpen &&
        location.pathname !== "/menu" &&
        location.pathname !== "/checkout" && <WhatsAppButton />}
    </>
  );
}

export default App;
