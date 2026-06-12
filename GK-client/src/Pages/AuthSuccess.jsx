import { useEffect } from "react";

export default function AuthSuccess() {
  useEffect(() => {
    const token = new URLSearchParams(
      window.location.search
    ).get("token");

    if (token) {
      localStorage.setItem("token", token);
    }

    window.location.href = "/";
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <h2>Signing you in...</h2>
    </div>
  );
}