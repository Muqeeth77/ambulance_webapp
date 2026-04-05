const mongoose = require("mongoose");

mongoose.connect("mongodb+srv://abdulmuqeethpc_db_user:admin123@ambulance.wdhgwkt.mongodb.net/test?retryWrites=true&w=majority")
  .then(() => {
    console.log("✅ MongoDB Connected Successfully!");
    process.exit();
  })
  .catch(err => {
    console.error("❌ Connection Error:", err.message);
    process.exit();
  });