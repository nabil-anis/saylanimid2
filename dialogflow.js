const dialogflow = require('@google-cloud/dialogflow');
const nodemailer = require('nodemailer');
const { WebhookClient, Suggestion } = require('dialogflow-fulfillment');
const express = require("express")
const cors = require("cors");
require('dotenv').config();
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const runGeminiChat = require('./services/gemini');
const app = express();
app.use(express.json())
app.use(cors());


// ✅ Setup email transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.APP_PASSWORD,
  },
});



const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.post("/webhook", async (req, res) => {
  var id = (res.req.body.session).substr(43);
  console.log(id)
  const agent = new WebhookClient({ request: req, response: res });

  function hi(agent) {
    console.log(`intent  =>  hi`);
    agent.add("hello from server")
  }

  async function emailsender(agent) {
    const { name, email, number, cnic, course } = agent.parameters;
    const fullName = name.name || name;

    const emailMessage = `
    <div style="max-width: 550px; margin: auto; padding: 20px; font-family: Arial, sans-serif; border: 1px solid #eee; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <img src="https://saylaniwelfare.com/static/media/logo.7236784a.png" alt="Saylani Logo" style="width: 120px; margin-bottom: 20px;">
      <h2 style="color: #2E86C1;">🎓 Saylani ITMAS Registration Confirmation</h2>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${number}</p>
      <p><strong>CNIC:</strong> ${cnic}</p>
      <p><strong>Selected Course:</strong> ${course}</p>
      <p style="margin-top: 20px;">✅ You’ve been successfully registered for the Saylani ITMAS training program.</p>
      <p><strong>Start Date:</strong> Monday, 9:00 AM</p>
      <p style="text-align: right; color: #888;">— Saylani Welfare Team</p>
    </div>
  `;

    agent.add(`✅ ${fullName}, we’ve sent your registration confirmation to ${email}. Check your inbox!`);

    try {
      const info = await transporter.sendMail({
        from: '"Saylani MASS IT TRAINING" <nabilanis1920@gmail.com>',
        to: email,
        subject: "🎓 IT Training Confirmation",
        html: emailMessage,
      });

      console.log("Email sent:", info.messageId);

      const message = await client.messages.create({
        from: 'whatsapp:+14155238886',
        body: `Hello ${fullName}, your ITMAS registration is confirmed. We’ve sent the details to ${email}.`,
        to: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
      });

      console.log("WhatsApp sent:", message.sid);

    } catch (error) {
      console.error("Error in email or WhatsApp:", error);
      agent.add("❌ There was an error sending your confirmation. Please try again later.");
    }
  }


  async function fallback(agent) {
    try {
      const action = req.body.queryResult.action;
      const queryText = req.body.queryResult.queryText;

      if (action === 'input.unknown') {
        const response = await runGeminiChat(queryText);
        agent.add(response);
        console.log("Gemini:", response);
      } else {
        agent.add("Sorry, I couldn't understand. Please rephrase.");
      }
    } catch (err) {
      console.error("Fallback error:", err);
      agent.add("There was a problem getting a response. Please try again.");
    }
  }

  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', hi);
  intentMap.set('email test', emailsender);
  intentMap.set('Default Fallback Intent', fallback);
  agent.handleRequest(intentMap);
})
app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});