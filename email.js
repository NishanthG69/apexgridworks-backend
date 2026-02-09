const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

function shortId(id){
  return "AGW-" + String(id).slice(-5);
}

async function sendMail(to, subject, html){
  if (!to) {
    console.error("❌ No recipient email provided");
    return;
  }

  return resend.emails.send({
    from: "Apex Grid Works <support@apexgridworks.shop>",
    to: [to],
    reply_to: "nishanth.gannu07@gmail.com",
    subject,
    html
  });
}

module.exports = { sendMail, shortId };
