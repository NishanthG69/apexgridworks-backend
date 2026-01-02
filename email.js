const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function shortId(id){
  return "AGW-" + String(id).slice(-5);
}

function sendMail(to, subject, html){
  return transporter.sendMail({
    from: `"Apex Grid Works" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
}

module.exports = { sendMail, shortId };
