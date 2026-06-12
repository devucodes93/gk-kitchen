import React from "react";
import { FaWhatsapp } from "react-icons/fa";
import "./WhatsAppButton.css";

const WhatsAppButton = () => {
  const phoneNumber = "6362533696";
  const message = "Hello! I would like to know more about your menu.";

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="whatsapp-float"
      aria-label="Chat on WhatsApp"
    >
      <span className="whatsapp-tooltip">Chat with us</span>
      <span className="whatsapp-icon">
        <FaWhatsapp size={32} />
      </span>
    </a>
  );
};

export default WhatsAppButton;