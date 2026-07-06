import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { allMenuItems } from "../constants/menu";
import OrderScreen from "./orderScreen/OrderScreen";

const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  let cart = [];
  try {
    cart =
      location.state?.cart ||
      JSON.parse(localStorage.getItem("gk-cart") || "[]");
  } catch {
    cart = [];
  }

  useEffect(() => {
    if (!cart.length) {
      navigate("/menu", { replace: true });
    }
  }, [cart.length, navigate]);

  if (!cart.length) return null;

  return (
    <OrderScreen
      item={cart[0] || allMenuItems[0]}
      initialCart={cart}
      initialScreen="checkout"
      onClose={() => navigate("/menu", { replace: true })}
    />
  );
};

export default CheckoutPage;
