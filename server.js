const { google } = require("googleapis");

require("dotenv").config();

const { sendMail, shortId } = require("./email");

const cors = require("cors");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());


app.get("/", (req, res) => {
  res.send("Apex Grid Works backend is running.");
});

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });

const fs = require("fs");
const path = require("path");

app.post("/api/order", async (req, res) => {
  const order = req.body;
  order.baseColor = order.baseColor || null;

  if (!order || !order.name || !order.phone || !order.product) {
    return res.status(400).json({ error: "Invalid order data" });
  }

  const filePath = path.join(__dirname, "orders.json");

  let orders = [];

  if (fs.existsSync(filePath)) {
    orders = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  order.id = Date.now();
  order.basePrice = order.basePrice;
  order.quality = order.quality || "STANDARD";
  order.priority = order.priority || false;
  order.status = "RECEIVED";
  order.createdAt = new Date().toISOString();

  let total = order.basePrice;
  if (order.quality === "PREMIUM") total += 50;
  if (order.priority) total += 50;

  order.total = total;

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Sheet1!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        order.id,
        order.createdAt,
        order.status,
        order.name,
        order.class,
        order.phone,
        order.email,
        order.product,
        order.color || "",
        order.baseColor || "",
        order.quality,
        order.priority,
        order.basePrice,
        order.total
      ]]
    }
  });


  console.log("New order received:", order);

  sendMail(
    order.email,
    `Apex Grid Works — Order ${shortId(order.id)} received`,
    `
    <p>Hi ${order.name},</p>

    <p>We’ve received your order.</p>

    <p>
      <b>Order ID:</b> ${shortId(order.id)}<br>
      <b>Product:</b> ${order.product}${order.team ? " — " + order.team : ""}<br>
      ${order.baseColor ? `<b>Base:</b> ${order.baseColor}<br>` : ""}
      ${order.quality === "PREMIUM" || order.priority
        ? `<b>Extras:</b>
          ${order.quality === "PREMIUM" ? "Premium Quality" : ""}
          ${order.quality === "PREMIUM" && order.priority ? ", " : ""}
          ${order.priority ? "Quick Delivery" : ""}
          <br>`
        : ""}
      <b>Total:</b> ₹${order.total}
    </p>

    <p>We’ll notify you when production starts.</p>
    <p>— Apex Grid Works</p>
    `
  );
  
  sendMail(
  process.env.ADMIN_EMAIL,
  `🆕 New Order — ${shortId(order.id)}`,
  `
  <p><b>New order received.</b></p>

  <p>
    <b>Order ID:</b> ${shortId(order.id)}<br>
    <b>Product:</b> ${order.product}${order.team ? " — " + order.team : ""}<br>
    ${order.baseColor ? `<b>Base:</b> ${order.baseColor}<br>` : ""}
    ${order.quality === "PREMIUM" || order.priority
      ? `<b>Extras:</b>
        ${order.quality === "PREMIUM" ? "Premium Quality" : ""}
        ${order.quality === "PREMIUM" && order.priority ? ", " : ""}
        ${order.priority ? "Quick Delivery" : ""}
        <br>`
      : ""}
    <b>Total:</b> ₹${order.total}
  </p>

  <hr>

  <p>
    <b>Customer:</b> ${order.name}<br>
    <b>Class:</b> ${order.class}<br>
    <b>Phone:</b> ${order.phone}<br>
    <b>Email:</b> ${order.email}
  </p>
  `
);

  res.json({ success: true });
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

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Sheet1!A2:Z"
  });

  const rows = response.data.values || [];

  const orders = rows.map(r => ({
    id: r[0],
    createdAt: r[1],
    status: r[2],
    name: r[3],
    class: r[4],
    phone: r[5],
    email: r[6],
    product: r[7],
    color: r[8],
    baseColor: r[9],
    quality: r[10],
    priority: r[11],
    basePrice: r[12],
    total: r[13]
  }));

  res.json(orders);


app.delete("/api/order/:id", (req, res) => {
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

  const filePath = path.join(__dirname, "orders.json");
  let orders = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : [];

  const before = orders.length;
  orders = orders.filter(o => o.id !== id);

  if (orders.length === before) {
    return res.status(404).send("Order not found");
  }

  fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));

  console.log(`Order ${id} deleted`);

  res.json({ success: true });
});

app.post("/api/order/status", (req, res) => {
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

  const filePath = path.join(__dirname, "orders.json");
  let orders = fs.existsSync(filePath)
    ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
    : [];

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).send("Order not found");

  order.status = status;
  order.updatedAt = new Date().toISOString();

  fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));

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
