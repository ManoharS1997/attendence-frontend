import { useState } from "react";

export default function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="eye-button"
        onClick={() => setShow((s) => !s)}
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
}
