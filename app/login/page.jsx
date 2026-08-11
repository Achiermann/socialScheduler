"use client";
import { useState } from "react";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) window.location.href = "/";
    else setError("Falscher Code.");
  }

  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Social Scheduler</h1>
        <input
          type="password"
          placeholder="Access-Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        <button type="submit">Einloggen</button>
        {error && <span className="msg">{error}</span>}
      </form>
    </div>
  );
}
