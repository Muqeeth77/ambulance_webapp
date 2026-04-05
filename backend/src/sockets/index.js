const { Server } = require("socket.io");
const { setIO } = require("../controllers/bookingController");

let io;

const initSockets = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  setIO(io);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("ambulance_request", (data) => {
      console.log("Request:", data);
      io.emit("ambulance_request", data);
    });

    socket.on("ambulance_location_update", (data) => {
      console.log("Location received:", data);
      io.emit("ambulance_location_update", data);
    });

    socket.on("ambulance_emergency", (data) => {
      console.log("Emergency:", data);
      io.emit("ambulance_emergency", data);
    });

    socket.on("police_acknowledged", (data) => {
      console.log("Police ACK:", data);
      io.emit("police_acknowledged", data);
    });

    socket.on("ambulance_trip_completed", (data) => {
      console.log("Trip completed:", data);
      io.emit("ambulance_trip_completed", data);
    });

    socket.on("in_app_call_offer", (data) => {
      console.log("Call offer:", data?.callId);
      io.emit("in_app_call_offer", data);
    });

    socket.on("in_app_call_answer", (data) => {
      console.log("Call answer:", data?.callId);
      io.emit("in_app_call_answer", data);
    });

    socket.on("in_app_call_ice", (data) => {
      io.emit("in_app_call_ice", data);
    });

    socket.on("in_app_call_reject", (data) => {
      console.log("Call rejected:", data?.callId);
      io.emit("in_app_call_reject", data);
    });

    socket.on("in_app_call_end", (data) => {
      console.log("Call ended:", data?.callId);
      io.emit("in_app_call_end", data);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

module.exports = { initSockets, getIO };
