const sendMessage = require("../handles/sendMessage");
const WebSocket = require("ws");
const axios = require("axios");

const activeSessions = new Map();
const lastSentCache = new Map();
const favoriteMap = new Map();
const globalLastSeen = new Map();

let sharedWebSocket = null;
let keepAliveInterval = null;

function formatValue(val) {
  if (val >= 1_000_000) return `x${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `x${(val / 1_000).toFixed(1)}K`;
  return `x${val}`;
}

function getPHTime() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
}

function getTimeAgo(date) {
  const now = getPHTime();
  const diff = now - new Date(date);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 60) return `${sec}s ago`;
  if (min < 60) return `${min}m ago`;
  if (hour < 24) return `${hour}h ago`;
  return `${day}d ago`;
}

function formatItems(items, useEmoji = true) {
  return items
    .filter(i => i.quantity > 0)
    .map(i => `- ${useEmoji && i.emoji ? i.emoji + " " : ""}${i.name}: ${formatValue(i.quantity)}`)
    .join("\n");
}

function cleanText(text) {
  return text.trim().toLowerCase();
}

function updateLastSeen(category, items) {
  if (!Array.isArray(items)) return;
  if (!globalLastSeen.has(category)) globalLastSeen.set(category, new Map());
  const catMap = globalLastSeen.get(category);
  const now = getPHTime();
  for (const item of items) {
    if (item.quantity > 0) {
      catMap.set(item.name, now);
    }
  }
}

function ensureWebSocketConnection() {
  if (sharedWebSocket && sharedWebSocket.readyState === WebSocket.OPEN) return;

  sharedWebSocket = new WebSocket("wss://gagstock.gleeze.com");

  sharedWebSocket.on("open", () => {
    keepAliveInterval = setInterval(() => {
      if (sharedWebSocket.readyState === WebSocket.OPEN) {
        sharedWebSocket.send("ping");
      }
    }, 10000);
  });

  sharedWebSocket.on("message", async (data) => {
    try {
      const payload = JSON.parse(data);
      if (payload.status !== "success" || !payload.data) return;

      const stock = payload.data;
      const stockData = {
        gear: stock.gear || { items: [] },
        seed: stock.seed || { items: [] },
        egg: stock.egg || { items: [] },
        cosmetics: stock.cosmetics || { items: [] },
        event: stock.honey || { items: [] },
        travelingmerchant: stock.travelingmerchant || { items: [] }
      };

      updateLastSeen("gear", stockData.gear.items);
      updateLastSeen("seed", stockData.seed.items);
      updateLastSeen("egg", stockData.egg.items);
      updateLastSeen("cosmetics", stockData.cosmetics.items);
      updateLastSeen("event", stockData.event.items);
      updateLastSeen("travelingmerchant", stockData.travelingmerchant.items);

      for (const [senderId, session] of activeSessions.entries()) {
        const favList = favoriteMap.get(senderId) || [];
        let sections = [];
        let matchCount = 0;

        function checkAndAdd(label, section, useEmoji, altCountdown = null) {
          const items = Array.isArray(section?.items) ? section.items.filter(i => i.quantity > 0) : [];
          if (items.length === 0) return false;
          const matchedItems = favList.length > 0
            ? items.filter(i => favList.includes(cleanText(i.name)))
            : items;
          if (favList.length > 0 && matchedItems.length === 0) return false;
          matchCount += matchedItems.length;
          const restockLabel = section.countdown || altCountdown;
          sections.push(`${label}:\n${formatItems(matchedItems, useEmoji)}${restockLabel ? `\n⏳ Restock In: ${restockLabel}` : ""}`);
          return true;
        }

        checkAndAdd("🛠️ 𝗚𝗲𝗮𝗿", stockData.gear, true);
        checkAndAdd("🌱 𝗦𝗲𝗲𝗱𝘀", stockData.seed, true);
        checkAndAdd("🥚 𝗘𝗴𝗴𝘀", stockData.egg, true);
        checkAndAdd("🎨 𝗖𝗼𝘀𝗺𝗲𝘁𝗶𝗰𝘀", stockData.cosmetics, false);
        checkAndAdd("🎉 𝗘𝘃𝗲𝗻𝘁", stockData.event, false);
        checkAndAdd("🚚 𝗧𝗿𝗮𝘃𝗲𝗹𝗶𝗻𝗴 𝗠𝗲𝗿𝗰𝗵𝗮𝗻𝘁", stockData.travelingmerchant, false, stockData.travelingmerchant.appearIn);

        if (favList.length > 0 && matchCount === 0) continue;
        if (sections.length === 0) continue;

        const updatedAt = getPHTime().toLocaleString("en-PH", {
          hour: "numeric", minute: "numeric", second: "numeric",
          hour12: true, day: "2-digit", month: "short", year: "numeric"
        });

        const weather = await axios.get("https://growagardenstock.com/api/stock/weather")
          .then(res => res.data).catch(() => null);

        const weatherInfo = weather
          ? `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${weather.icon} ${weather.weatherType}\n📋 ${weather.description}\n🎯 ${weather.cropBonuses}\n`
          : "";

        const title = favList.length > 0
          ? `♥️ ${matchCount} 𝗙𝗮𝘃𝗼𝗿𝗶𝘁𝗲 𝗶𝘁𝗲𝗺${matchCount > 1 ? "s" : ""} 𝗙𝗼𝘂𝗻𝗱!`
          : "🌾 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 — 𝗧𝗿𝗮𝗰𝗸𝗲𝗿";

        const messageKey = JSON.stringify({ title, sections, weatherInfo, updatedAt });
        const lastSent = lastSentCache.get(senderId);
        if (lastSent === messageKey) continue;

        lastSentCache.set(senderId, messageKey);

        await sendMessage(senderId, `${title}\n\n${sections.join("\n\n")}\n\n${weatherInfo}📅 Updated at (PH): ${updatedAt}`);
      }
    } catch (err) {
      console.error("WebSocket message error:", err);
    }
  });

  sharedWebSocket.on("close", () => {
    clearInterval(keepAliveInterval);
    sharedWebSocket = null;
    setTimeout(ensureWebSocketConnection, 3000);
  });

  sharedWebSocket.on("error", () => sharedWebSocket?.close());
}

async function fetchPredict(params) {
  try {
    const res = await axios.get("https://gagstock.gleeze.com/predict", { params });
    if (res.data.status === "success" && res.data.data) return res.data.data;
  } catch (err) {
    console.error("Predict API error:", err);
  }
  return null;
}

function formatPredictData(data, filters = []) {
  if (!data) return "⚠️ Failed to fetch predictions.";

  const cats = ["seed", "gear", "egg"];
  let selectedCats = cats;
  if (filters.length > 0) {
    selectedCats = filters.filter(c => cats.includes(c));
  }

  const lines = [];
  for (const cat of selectedCats) {
    if (!data[cat] || !Array.isArray(data[cat])) continue;
    if (data[cat].length === 0) continue;

    lines.push(`🔹 ${cat.toUpperCase()} (${data[cat].length})`);
    for (const item of data[cat]) {
      const showTime = item.showTime || "Unknown";
      lines.push(`- ${item.name}: ${showTime}`);
    }
    lines.push("");
  }

  if (lines.length === 0) return "⚠️ No predictions found for the specified filters.";
  return lines.join("\n").trim();
}

const gangstockCommand = async (senderId, argsString) => {
  const args = argsString ? argsString.trim().split(/\s+/) : [];
  const subcmd = args[0]?.toLowerCase();

  if (subcmd === "fav") {
    const action = args[1]?.toLowerCase();
    const input = args.slice(2).join(" ").split("|").map(i => cleanText(i)).filter(Boolean);
    if (!action || !["add", "remove"].includes(action) || input.length === 0) {
      return sendMessage(senderId, "📌 Usage: gangstock fav add/remove Item1 | Item2");
    }
    const currentFav = favoriteMap.get(senderId) || [];
    const updated = new Set(currentFav);
    for (const name of input) {
      if (action === "add") updated.add(name);
      else if (action === "remove") updated.delete(name);
    }
    favoriteMap.set(senderId, Array.from(updated));
    return sendMessage(senderId, `✅ Favorite list updated: ${Array.from(updated).join(", ") || "(empty)"}`);
  }

  if (subcmd === "lastseen") {
    const filters = args.slice(1).join(" ").split("|").map(c => c.trim().toLowerCase()).filter(Boolean);
    const categories = filters.length > 0 ? filters : ["gear", "seed", "egg", "cosmetics", "event", "travelingmerchant"];

    let result = [];
    for (const cat of categories) {
      const entries = globalLastSeen.get(cat);
      if (!entries || entries.size === 0) continue;

      const list = Array.from(entries.entries())
        .sort((a, b) => new Date(b[1]) - new Date(a[1]))
        .map(([name, date]) => `• ${name}: ${getTimeAgo(date)}`);

      result.push(`🔹 ${cat.toUpperCase()} (${list.length})\n${list.join("\n")}`);
    }

    if (result.length === 0) {
      return sendMessage(senderId, "⚠️ No last seen data found for the selected category.");
    }

    return sendMessage(senderId, `📦 𝗟𝗮𝘀𝘁 𝗦𝗲𝗲𝗻 𝗜𝘁𝗲𝗺𝘀\n\n${result.join("\n\n")}`);
  }

  if (subcmd === "off") {
    if (!activeSessions.has(senderId)) {
      return sendMessage(senderId, "⚠️ You don't have an active gangstock session.");
    }
    activeSessions.delete(senderId);
    lastSentCache.delete(senderId);
    return sendMessage(senderId, "🛑 Gangstock tracking stopped.");
  }

  if (subcmd === "predict") {
    const inputFilters = args.slice(1).join(" ").split("|").map(i => cleanText(i)).filter(Boolean);

    const allowedTypes = ["seed", "gear", "egg"];
    const filters = [];
    const items = [];

    for (const f of inputFilters) {
      if (allowedTypes.includes(f)) filters.push(f);
      else items.push(f);
    }

    let query = "";
    if (filters.length === 0 && items.length === 0) {
      query = "seed|gear|egg";
    } else {
      const parts = [];
      if (filters.length > 0) parts.push(filters.join("|"));
      if (items.length > 0) parts.push(items.join("|"));
      query = parts.join("|");
    }

    const data = await fetchPredict({ q: query });
    if (!data) return sendMessage(senderId, "⚠️ Failed to fetch predictions from API.");

    if (items.length > 0) {
      for (const cat of ["seed", "gear", "egg"]) {
        if (data[cat]) {
          data[cat] = data[cat].filter(i => items.includes(cleanText(i.name)));
        }
      }
    }

    if (filters.length > 0) {
      for (const cat of ["seed", "gear", "egg"]) {
        if (!filters.includes(cat)) data[cat] = [];
      }
    }

    const formatted = formatPredictData(data, filters.length > 0 ? filters : ["seed", "gear", "egg"]);
    return sendMessage(senderId, formatted);
  }

  if (subcmd !== "on") {
    return sendMessage(senderId, "📌 Usage:\n• gangstock on\n• gangstock fav add Carrot | Watering Can\n• gangstock lastseen gear | seed\n• gangstock predict\n• gangstock predict seed\n• gangstock predict gear | egg\n• gangstock predict carrot | watering can\n• gangstock off");
  }

  if (activeSessions.has(senderId)) {
    return sendMessage(senderId, "📡 You're already tracking Gangstock. Use gangstock off to stop.");
  }

  activeSessions.set(senderId, { startedAt: new Date() });
  ensureWebSocketConnection();

  return sendMessage(senderId, "✅ Gangstock tracking started! You will receive real-time stock updates.\n\n💡 Tips:\n• gangstock fav add Carrot | Watering Can - Track specific items\n• gangstock lastseen gear - See when items were last in stock\n• gangstock predict - Get stock predictions\n• gangstock off - Stop tracking");
};

module.exports = gangstockCommand;

module.exports.info = {
  name: "gangstock",
  description: "Track Grow A Garden stock with favorites, real-time updates via WebSocket, last seen items, and stock predictions.",
  usage: "gangstock on | gangstock off | gangstock fav add Item1 | Item2 | gangstock lastseen gear | egg | gangstock predict | gangstock predict seed"
};
