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
  process.env.SUPABASE_KEY,
);

// --- KLUCZOWA ZMIANA: REJESTRACJA PRZY /START ---
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const userName = ctx.from.first_name || "Gracz";

  try {
    // Sprawdzamy, czy gracz już istnieje
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Jeśli nie istnieje, tworzymy go OD RAZU
    if (!profile) {
      await supabase
        .from("profiles")
        .insert([{ user_id: userId, balance: 0, spins: 0 }]); // Dajemy 0 spinów na start
      console.log(`Stworzono nowy profil dla: ${userId}`);
    }

    ctx.reply(
      `🎰 Witaj ${userName} w Loterii Diamentów!\n\nTwój profil jest gotowy. Kupuj zakręcenia gwiazdkami i wygrywaj wirtualne diamenty!`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⭐️ Kup 1 Zakręcenie (5 ⭐)",
                callback_data: "buy_spin",
              },
            ],
            [
              {
                text: "🎮 Otwórz Koło Fortuny",
                web_app: { url: "https://mashamtmt-hub.github.io/loteria/" },
              },
            ],
          ],
        },
      },
    );
  } catch (err) {
    console.error("Błąd przy /start:", err);
    ctx.reply("Wystąpił problem przy ładowaniu profilu. Spróbuj za chwilę!");
  }
});

bot.action("buy_spin", (ctx) => {
  ctx.replyWithInvoice({
    title: "Zakręcenie Kołem",
    description: "Kupujesz 1 szansę na wygraną w naszej grze.",
    payload: "spin_1",
    provider_token: "", // Puste dla Telegram Stars
    currency: "XTR",
    prices: [{ label: "1x Spin", amount: 5 }],
  });
  ctx.answerCbQuery();
});

bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on("successful_payment", async (ctx) => {
  const userId = ctx.from.id.toString();
  try {
    // Pobieramy aktualny stan profilu
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (profile) {
      await supabase
        .from("profiles")
        .update({ spins: (profile.spins || 0) + 1 })
        .eq("user_id", userId);
      
      ctx.reply("✅ Płatność udana! Otrzymałeś 1 zakręcenie. Powodzenia! 🍀");
    }
  } catch (err) {
    console.error("Błąd po płatności:", err);
    ctx.reply("Błąd zapisu spinów. Napisz do administracji!");
  }
});

app.get("/", (req, res) => res.send("Serwer bota działa!"));

app.listen(3000, () => console.log("Serwer HTTP na porcie 3000"));

bot.launch().then(() => console.log("Bot na Telegramie podłączony! 🚀"));
