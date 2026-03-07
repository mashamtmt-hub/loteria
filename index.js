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

// --- 1. ENDPOINT DLA TWOJEGO KOŁA FORTUNY (WEB APP) ---
// Ta część pozwala Twojej stronie na GitHubie poprosić o link do płatności Stars
app.post("/create-stars-invoice", async (req, res) => {
  const { userId, amount } = req.body;

  try {
    // Generowanie specjalnego linku do faktury Telegram Stars
    const link = await bot.telegram.createInvoiceLink(
      `Pakiet ${amount} Diamentów`,
      `Doładowanie salda 1:1 w Diamond Casino`,
      `user_${userId}_pay_${Date.now()}`,
      "", // Provider token - pusty dla Stars (XTR)
      "XTR", // Waluta: Telegram Stars
      [{ label: "Diamenty", amount: amount }]
    );
    
    res.json({ link });
  } catch (e) {
    console.error("Błąd tworzenia faktury:", e);
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
        .insert([{ user_id: userId, balance: 10, spins: 0 }]); // 10 diamentów na start
    }

    ctx.reply(
      `🎰 Witaj ${userName}!\n\nZasada jest prosta: 1 Gwiazdka (Stars) = 1 Diament 💎.\nUżywaj diamentów, aby kręcić kołem i wygrywać więcej!`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🎮 ZAGRAJ TERAZ",
                web_app: { url: "https://mashamtmt-hub.github.io/loteria/" },
              },
            ],
          ],
        },
      }
    );
  } catch (err) {
    console.error("Błąd przy /start:", err);
  }
});

// --- 3. OBSŁUGA PŁATNOŚCI (STARS) ---

// Potwierdzenie gotowości do transakcji
bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

// Co się dzieje po udanym zakupie
bot.on("successful_payment", async (ctx) => {
  const userId = ctx.from.id.toString();
  const amount = ctx.message.successful_payment.total_amount; // Ilość zapłaconych Stars

  try {
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profile) {
      // Dodajemy diamenty 1:1 do salda
      const newBalance = (profile.balance || 0) + amount;
      
      await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("user_id", userId);
      
      ctx.reply(`✅ Sukces! Doładowano ${amount} 💎. Twoje nowe saldo to ${newBalance}. Powodzenia!`);
    }
  } catch (err) {
    console.error("Błąd po płatności:", err);
    ctx.reply("Wystąpił błąd przy aktualizacji salda diamentów.");
  }
});

app.get("/", (req, res) => res.send("Serwer bota i płatności Stars działa!"));

// Render automatycznie przypisuje port, więc lepiej użyć process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer HTTP na porcie ${PORT}`));

bot.launch().then(() => console.log("Bot kasjera Stars podłączony! 🚀"));
