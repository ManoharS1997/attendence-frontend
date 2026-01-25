import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

const IDLE_TIME = 5 * 60 * 1000; // 5 minutes

const useIdleLogout = () => {
  const timerRef = useRef(null);
  const { logout, user } = useAuth();

  const resetTimer = useCallback(() => {
    if (!user) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      toast.warning(
        <>
          <strong>Session Expired</strong>
          <div style={{ fontSize: "13px", marginTop: "4px" }}>
            You were logged out due to inactivity. Please login again.
          </div>
        </>,
        {
          position: "top-center",
          autoClose: 4000,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: false,
        }
      );

      logout();
    }, IDLE_TIME);
  }, [logout, user]);

  useEffect(() => {
    if (!user) return;

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    events.forEach(event =>
      window.addEventListener(event, resetTimer)
    );

    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, [resetTimer, user]);
};

export default useIdleLogout;
