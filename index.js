const express = require("express");
const { Telegraf } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const bot = new Telegraf(process.env.BOT_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// --- 1. ENDPOINT DLA TWOJEGO KOŁA FORTUNY ---
app.post("/create-stars-invoice", async (req, res) => {
  const { userId, amount } = req.body;
  console.log(`📥 Otrzymano prośbę o fakturę: User ${userId}, Ilość: ${amount}`);

  try {
    // KLUCZOWA ZMIANA: Przekazujemy jeden obiekt {} zamiast wielu argumentów
    const link = await bot.telegram.createInvoiceLink({
      title: `Pakiet ${amount} Diamentów`,
      description: `Doładowanie salda 1:1 w Diamond Casino`,
      payload: `user_${userId}_pay_${Date.now()}`,
      provider_token: "", // Puste dla Stars
      currency: "XTR",    // Waluta Stars
      prices: [{ label: "Diamenty", amount: parseInt(amount) }]
    });
    
    console.log("✅ Faktura wygenerowana pomyślnie");
    res.json({ link });
  } catch (e) {
    console.error("❌ Błąd tworzenia faktury:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- 2. LOGIKA PRZYCISKU /START ---
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const userName = ctx.from.first_name || "Gracz";

  try {
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      await supabase
        .from("profiles")
        .insert([{ user_id: userId, balance: 10, spins: 0 }]);
    }

    ctx.reply(
      `🎰 Witaj ${userName}!\n\nZasada: 1 Stars ⭐️ = 1 Diament 💎.\nPowodzenia!`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🎮 ZAGRAJ TERAZ", web_app: { url: "https://mashamtmt-hub.github.io/loteria/" } }],
          ],
        },
      }
    );
  } catch (err) {
    console.error("Błąd przy /start:", err);
  }
});

// --- 3. OBSŁUGA PŁATNOŚCI ---
bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on("successful_payment", async (ctx) => {
  const userId = ctx.from.id.toString();
  const amount = ctx.message.successful_payment.total_amount;
  console.log(`💰 Udana wpłata: ${amount} Stars od użytkownika ${userId}`);

  try {
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profile) {
      const newBalance = (profile.balance || 0) + amount;
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", userId);
      ctx.reply(`✅ Doładowano ${amount} 💎! Nowe saldo: ${newBalance}`);
    }
  } catch (err) {
    console.error("❌ Błąd zapisu płatności:", err);
  }
});

app.get("/", (req, res) => res.send("Serwer bota Stars działa! 🚀"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer HTTP na porcie ${PORT}`));

bot.launch().catch(err => console.error("Błąd startu bota:", err));
