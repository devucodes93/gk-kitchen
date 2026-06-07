import React, { useState } from "react";

const Login = ({ isLoginOpen, setIsLoginOpen }) => {
  const [phone, setPhone] = useState("");
  return (
    <>
      {isLoginOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "var(--color-black)",
              border: "2px solid var(--color-golden)",
              padding: "3rem 2rem",
              borderRadius: "12px",
              width: "90%",
              maxWidth: "500px",
              position: "relative",
              textAlign: "center",
            }}
          >
            <button
              style={{
                position: "absolute",
                top: "15px",
                right: "20px",
                background: "none",
                border: "none",
                color: "var(--color-golden)",
                fontSize: "24px",
                cursor: "pointer",
              }}
              onClick={() => setIsLoginOpen(false)}
            >
              &times;
            </button>

            <h2
              style={{
                color: "var(--color-golden)",
                fontSize: "32px",
                marginBottom: "10px",
              }}
            >
              Sign In
            </h2>

            <p
              style={{
                color: "#aaa",
                marginBottom: "2rem",
              }}
            >
              Enter your mobile number to continue
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                border: "1px solid var(--color-golden)",
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "1.5rem",
              }}
            >
              <span
                style={{
                  padding: "12px",
                  color: "var(--color-golden)",
                  borderRight: "1px solid var(--color-golden)",
                }}
              >
                +91
              </span>

              <input
                type="tel"
                placeholder="Enter mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#fff",
                  padding: "12px",
                }}
              />
            </div>

            <button
              className="custom__button"
              style={{
                width: "100%",
              }}
            >
              Request OTP
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;
