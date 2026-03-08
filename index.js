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

// --- 1. ENDPOINT: PŁATNOŚCI STARS ---
app.post("/create-stars-invoice", async (req, res) => {
  const { userId, amount } = req.body;
  console.log(`📥 Otrzymano prośbę o fakturę: User ${userId}, Ilość: ${amount}`);

  try {
    const link = await bot.telegram.createInvoiceLink({
      title: `Pakiet ${amount} Diamentów`,
      description: `Doładowanie salda 1:1 w Diamond Casino`,
      payload: `user_${userId}_pay_${Date.now()}`,
      provider_token: "", 
      currency: "XTR",    
      prices: [{ label: "Diamenty", amount: parseInt(amount) }]
    });
    
    console.log("✅ Faktura wygenerowana pomyślnie");
    res.json({ link });
  } catch (e) {
    console.error("❌ Błąd tworzenia faktury:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- 2. ENDPOINT: DARMOWY PREZENT (CO 24H) ---
app.post("/claim-gift", async (req, res) => {
  const { userId } = req.body;
  console.log(`🎁 Próba odebrania prezentu: User ${userId}`);

  try {
    let { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();

    if (!profile) return res.status(404).json({ error: "Brak profilu" });

    const now = new Date();
    const lastGift = profile.last_gift_at ? new Date(profile.last_gift_at) : new Date(0);
    const diff = now - lastGift;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    if (diff >= twentyFourHours) {
      const newBalance = (profile.balance || 0) + 5;
      await supabase.from('profiles')
        .update({ balance: newBalance, last_gift_at: now.toISOString() })
        .eq('user_id', userId);
        
      res.json({ success: true, newBalance: newBalance });
    } else {
      const remaining = twentyFourHours - diff;
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      res.json({ success: false, message: `Prezent dostępny za: ${hours}h ${minutes}m` });
    }
  } catch (e) {
    console.error("❌ Błąd prezentu:", e);
    res.status(500).json({ error: "Błąd serwera" });
  }
});

// --- 3. LOGIKA BOTA: /START ---
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

// --- 4. OBSŁUGA PŁATNOŚCI STARS ---
bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on("successful_payment", async (ctx) => {
  const userId = ctx.from.id.toString();
  const amount = ctx.message.successful_payment.total_amount;
  console.log(`💰 Udana wpłata: ${amount} Stars od użytkownika ${userId}`);

  try {
    let { data: profile } = await supabase.from("profiles").select("*").eq("user_id", userId).single();

    if (profile) {
      const newBalance = (profile.balance || 0) + amount;
      await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", userId);
      ctx.reply(`✅ Doładowano ${amount} 💎! Nowe saldo: ${newBalance}`);
    }
  } catch (err) {
    console.error("❌ Błąd zapisu płatności:", err);
  }
});

// --- 5. SERWER HTTP I START ---
app.get("/", (req, res) => res.send("Serwer Diamond Casino działa! 🚀"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serwer HTTP na porcie ${PORT}`));

bot.launch().catch(err => console.error("Błąd startu bota:", err));
