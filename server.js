require("dotenv").config();

const { sendMail, shortId } = require("./email");

const cors = require("cors");
const express = require("express");
const app = express();
const PORT = 3000;

app.get("/ping", (req, res) => {
  res.send("Server awake");
});

app.use(express.json());
app.use(cors());


app.get("/", (req, res) => {
  res.send("Apex Grid Works backend is running.");
});

const fs = require("fs");
const path = require("path");

const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

const OrderSchema = new mongoose.Schema({
  id: Number,

  name: String,
  class: String,
  board: String,
  phone: String,
  email: String,

  product: String,
  team: String,
  baseColor: String,
  color: String,
  basePrice: Number,
  quality: String,
  priority: Boolean,
  total: Number,

  status: String,

  createdAt: String,
  updatedAt: String
});

const Order = mongoose.model("Order", OrderSchema);


app.post("/api/order", async (req, res) => {
  if (req.body.warmup === true) {
    console.log("Warmup ping received.");
    return res.json({ success: true, warmup: true });
  }
  
  try {
    const order = req.body;
    order.baseColor ||= null;

    if (!order?.name || !order.phone || !order.product) {
      return res.status(400).json({ error: "Invalid order data" });
    }

    order.id = Date.now();
    order.quality ||= "STANDARD";
    order.priority ||= false;
    order.status = "RECEIVED";
    order.createdAt = new Date().toISOString();

    let total = order.basePrice;
    if (order.quality === "PREMIUM") total += 50;
    if (order.priority) total += 50;
    order.total = total;

    // ✅ SAVE TO MONGODB (ONLY)
    await Order.create(order);

    console.log("Order saved to MongoDB:", order.id);

    // ✉️ EMAILS — KEEP YOUR EXISTING HTML
    sendMail(
      order.email,
      `Apex Grid Works — Order ${shortId(order.id)} received`,
      `...`
    );

    sendMail(
      process.env.ADMIN_EMAIL,
      `🆕 New Order — ${shortId(order.id)}`,
      `...`
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Order save failed:", err);
    res.status(500).json({ error: "Order failed" });
  }
});

app.get("/orders1157", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.get("/api/orders", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return res.status(401).send("Unauthorized");
  }

  const credentials = Buffer
    .from(authHeader.split(" ")[1], "base64")
    .toString("utf-8");

  const [username, password] = credentials.split(":");

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).send("Unauthorized");
  }

  const orders = await Order.find().sort({ createdAt: -1 });
  res.json(orders);
});

app.delete("/api/order/:id", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return res.status(401).send("Unauthorized");
  }

  const credentials = Buffer
    .from(authHeader.split(" ")[1], "base64")
    .toString("utf-8");

  const [username, password] = credentials.split(":");

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).send("Unauthorized");
  }

  const id = Number(req.params.id);

  const result = await Order.deleteOne({ id });

  if (result.deletedCount === 0) {
    return res.status(404).send("Order not found");
  }

  console.log(`Order ${id} deleted`);
  res.json({ success: true });


    console.log(`Order ${id} deleted`);

    res.json({ success: true });
  });

app.post("/api/order/status", async (req, res) => {
  const authHeader = req.headers.authorization; 

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return res.status(401).send("Unauthorized");
  }

  const credentials = Buffer
    .from(authHeader.split(" ")[1], "base64")
    .toString("utf-8");

  const [username, password] = credentials.split(":");

  if (
    username !== process.env.ADMIN_USERNAME ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return res.status(401).send("Unauthorized");
  }

  const id = Number(req.body.id);
  const status = req.body.status;

  if (!id || !status) {
    return res.status(400).send("Invalid request");
  }

  const order = await Order.findOne({ id });

  if (!order) {
    return res.status(404).send("Order not found");
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();

  await order.save();

  console.log(`Order ${id} → ${status}`);


  console.log(`Order ${id} → ${status}`);

  if (status === "IN_PRODUCTION") {
    console.log("SENDING IN PRODUCTION EMAIL");
    sendMail(
      order.email,
      `Apex Grid Works — Order ${shortId(order.id)} in production`,
      `
      <p>Hi ${order.name},</p>

      <p>Your order <b>${shortId(order.id)}</b> is now in production.</p>

      <p>
        <b>Product:</b> ${order.product}${order.team ? " — " + order.team : ""}<br>
        ${order.baseColor ? `<b>Base:</b> ${order.baseColor}<br>` : ""}
        ${order.quality === "PREMIUM" || order.priority
          ? `<b>Extras:</b>
            ${order.quality === "PREMIUM" ? "Premium Quality" : ""}
            ${order.quality === "PREMIUM" && order.priority ? ", " : ""}
            ${order.priority ? "Quick Delivery" : ""}
            <br>`
          : ""}
      </p>

      <p>We’ll notify you once it’s ready.</p>
      <p>— Apex Grid Works</p>
      `
    );
  }

  if (status === "DELIVERED") {
    console.log("SENDING DELIVERED EMAIL");
    sendMail(
      order.email,
      `Apex Grid Works — Order ${shortId(order.id)} completed`,
      `
      <p>Hi ${order.name},</p>

      <p>Your order <b>${shortId(order.id)}</b> has been completed.</p>

      <p>
        <b>Product:</b> ${order.product}${order.team ? " — " + order.team : ""}<br>
        ${order.baseColor ? `<b>Base:</b> ${order.baseColor}<br>` : ""}
        ${order.quality === "PREMIUM" || order.priority
          ? `<b>Extras:</b>
            ${order.quality === "PREMIUM" ? "Premium Quality" : ""}
            ${order.quality === "PREMIUM" && order.priority ? ", " : ""}
            ${order.priority ? "Quick Delivery" : ""}
            <br>`
          : ""}
      </p>

      <p>If you have any questions, feel free to reply to this email.</p>

      <p>Thanks for supporting Apex Grid Works 🏁</p>
      <p>— Apex Grid Works</p>
      `
    );
  }

  res.json({ success: true });
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

