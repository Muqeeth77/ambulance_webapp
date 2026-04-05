import { useEffect } from "react";
import useSocket from "./useSocket";

const useSocketEvent = (socketOrEvent, eventOrHandler, maybeHandler) => {
  const socketContext = useSocket();

  const socket =
    typeof socketOrEvent === "string"
      ? socketContext?.socket
      : socketOrEvent;
  const event =
    typeof socketOrEvent === "string" ? socketOrEvent : eventOrHandler;
  const handler =
    typeof socketOrEvent === "string" ? eventOrHandler : maybeHandler;

  useEffect(() => {
    if (!socket || !event || typeof handler !== "function") return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, event, handler]);
};

export default useSocketEvent;
