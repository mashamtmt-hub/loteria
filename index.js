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

bot.start((ctx) => {
  ctx.reply(
    "🎰 Witaj w Loterii Diamentów!\n\nKupuj zakręcenia gwiazdkami i wygrywaj wirtualne diamenty!",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "⭐️ Kup 1 Zakręcenie (5 Gwiazdek)",
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
});

bot.action("buy_spin", (ctx) => {
  ctx.replyWithInvoice({
    title: "Zakręcenie Kołem",
    description: "Kupujesz 1 szansę na wygraną w naszej grze.",
    payload: "spin_1",
    provider_token: "",
    currency: "XTR",
    prices: [{ label: "1x Spin", amount: 5 }],
  });
  ctx.answerCbQuery();
});

bot.on("pre_checkout_query", (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on("successful_payment", async (ctx) => {
  const userId = ctx.from.id.toString();
  try {
    let { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (!profile) {
      await supabase
        .from("profiles")
        .insert([{ user_id: userId, balance: 0, spins: 1 }]);
    } else {
      await supabase
        .from("profiles")
        .update({ spins: profile.spins + 1 })
        .eq("user_id", userId);
    }
    ctx.reply(
      "✅ Dziękujemy! Otrzymałeś 1 zakręcenie. Możesz teraz wejść do gry!",
    );
  } catch (err) {
    ctx.reply("Błąd bazy danych, ale płatność przeszła. Napisz do admina!");
  }
});

app.get("/", (req, res) => res.send("Serwer bota działa!"));

app.listen(3000, () => console.log("Serwer HTTP na porcie 3000"));

bot.launch().then(() => console.log("Bot na Telegramie podłączony! 🚀"));
