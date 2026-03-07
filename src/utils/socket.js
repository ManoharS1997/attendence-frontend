import { io } from "socket.io-client";

const socket = io("https://attendencetracker.nowitservices.com", {
  withCredentials: true,
  transports: ["websocket", "polling"],
});

export default socket;