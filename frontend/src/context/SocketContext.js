import React, { createContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export const SocketContext = createContext(null);

const SOCKET_URL = "http://127.0.0.1:5000";

export const SocketProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const nextSocket = io(SOCKET_URL, {
      transports: ["websocket"],
    });

    nextSocket.on("connect", () => {
      console.log("Socket connected:", nextSocket.id);
      setConnected(true);
    });

    nextSocket.on("disconnect", () => {
      console.log("Socket disconnected");
      setConnected(false);
    });

    nextSocket.on("connect_error", (err) => {
      console.log("Connection error:", err.message);
      setConnected(false);
    });

    socketRef.current = nextSocket;
    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  const emit = (event, data) => {
    socketRef.current?.emit(event, data);
  };

  const on = (event, callback) => {
    socketRef.current?.on(event, callback);
    return () => socketRef.current?.off(event, callback);
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
        emit,
        on,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
