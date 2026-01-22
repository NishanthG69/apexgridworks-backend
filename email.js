const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

function shortId(id){
  return "AGW-" + String(id).slice(-5);
}

async function sendMail(to, subject, html){
  return resend.emails.send({
    from: "Apex Grid Works <onboarding@resend.dev>",
    to,
    subject,
    html
  });
}

module.exports = { sendMail, shortId };
