import React from "react";

const Login = ({ isLoginOpen, setIsLoginOpen }) => {
  if (!isLoginOpen) return null;

  const handleGoogleLogin = () => {
    window.location.href =
      "http://localhost:5000/api/auth/google";
  };

  return (
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
          onClick={() => setIsLoginOpen(false)}
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
        >
          &times;
        </button>

        <h2
          style={{
            color: "var(--color-golden)",
            marginBottom: "10px",
          }}
        >
          Welcome to Gautam Kitchen
        </h2>

        <p
          style={{
            color: "#aaa",
            marginBottom: "30px",
          }}
        >
          Sign in with your Google account to continue
        </p>

        <button
          onClick={handleGoogleLogin}
          className="custom__button"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
          }}
        >
          <img
            src="https://developers.google.com/identity/images/g-logo.png"
            alt="Google"
            width="20"
            height="20"
          />
          Continue with Google
        </button>
      </div>
    </div>
  );
};

export default Login;