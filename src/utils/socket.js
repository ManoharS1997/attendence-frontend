import { io } from "socket.io-client";

const socket = io("https://attendencetracker.nowitservices.com", {
  withCredentials: true,
});

export default socket;