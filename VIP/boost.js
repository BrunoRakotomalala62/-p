const axios = require("axios");
const UserAgents = require("user-agents");
const https = require("https");
const sendMessage = require('../handles/sendMessage');

const BASE_URL = "https://boostgrams.com";
const API_URL = `${BASE_URL}/action/`;

const userBoostSessions = new Map();

const randomIP = () => 
  Array(4).fill(0).map(() => Math.floor(Math.random() * 256)).join(".");

const randomUA = () => 
  new UserAgents({ deviceCategory: "mobile", platform: /(Android|iPhone)/ }).toString();

let cookieJar = {};

const cookiesToHeader = () => 
  Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join("; ");

const mergeCookies = (res) => {
  const cookies = res.headers["set-cookie"];
  if (!cookies) return;
  cookies.forEach((raw) => {
    const [pair] = raw.split(";");
    const [key, val] = pair.split("=");
    if (key) cookieJar[key.trim()] = val || "";
  });
};

const getHeaders = (isPage, ip, ua) => ({
  "User-Agent": ua,
  "Accept-Language": "en-US,en;q=0.9",
  "X-Forwarded-For": ip,
  "X-Real-IP": ip,
  Cookie: cookiesToHeader(),
  Accept: isPage 
    ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    : "application/json, */*;q=0.1",
  ...(isPage ? {} : {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest"
  })
});

const buildBody = (url, token = "") => {
  const p = new URLSearchParams();
  p.append("ns_action", "freetool_start");
  p.append("freetool[id]", "22");
  p.append("freetool[token]", token);
  p.append("freetool[process_item]", url);
  p.append("freetool[quantity]", "100");
  return p.toString();
};

const initSession = async (ip, ua) => {
  cookieJar = {};
  await axios.get(BASE_URL, { headers: getHeaders(true, ip, ua), timeout: 15000 });
  await axios.get(`${BASE_URL}/free-tiktok-views/`, { 
    headers: getHeaders(true, ip, ua), 
    timeout: 15000 
  });
};

const generateBypassUrl = (url) => {
  const rand = Math.random().toString(36).substring(2);
  const time = Date.now();
  return `${url}?ref=boost${rand}${time}&t=${time}`;
};

const cleanUrl = (url) => {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
};

const resolveShortUrl = (shortUrl) => 
  new Promise((resolve, reject) => {
    https.request(shortUrl, {
      method: "HEAD",
      headers: { "User-Agent": randomUA(), Accept: "*/*" }
    }, (res) => {
      const loc = res.headers.location;
      if (!loc) return reject(new Error("No redirect"));
      
      if (loc.includes("tiktok.com/@") && loc.includes("/video/")) {
        resolve(loc);
      } else {
        resolveShortUrl(loc).then(resolve).catch(reject);
      }
    }).on("error", reject).end();
  });

const prepareUrl = async (input) => {
  if (input.includes("vt.tiktok.com") || input.includes("vm.tiktok.com")) {
    try {
      return cleanUrl(await resolveShortUrl(input));
    } catch {
      return cleanUrl(input);
    }
  }
  return cleanUrl(input);
};

const boostOnce = async (url) => {
  const ip = randomIP();
  const ua = randomUA();

  try {
    const bypassUrl = generateBypassUrl(url);
    await initSession(ip, ua);

    const step1 = await axios.post(API_URL, buildBody(bypassUrl), {
      headers: getHeaders(false, ip, ua),
      validateStatus: () => true,
      timeout: 20000
    });

    mergeCookies(step1);

    const token = step1.data?.freetool_process_token;
    if (!token) return { success: false, stage: "token" };

    const step2 = await axios.post(API_URL, buildBody(bypassUrl, token), {
      headers: getHeaders(false, ip, ua),
      validateStatus: () => true,
      timeout: 20000
    });

    return (step2.data?.statu || step2.data?.success)
      ? { success: true, views: 100, likes: 100 }
      : { success: false, stage: "execute" };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

module.exports = async (senderId, prompt, api) => {
  try {
    const input = (typeof prompt === 'string') ? prompt.trim() : '';
    const userSession = userBoostSessions.get(senderId) || {};

    if (input.toLowerCase() === 'stop') {
      if (userSession.isRunning) {
        userSession.shouldStop = true;
        userBoostSessions.set(senderId, userSession);
        await sendMessage(senderId, `
🛑 𝗔𝗥𝗥𝗘̂𝗧 𝗗𝗘𝗠𝗔𝗡𝗗𝗘́ 🛑
━━━━━━━━━━━━━━━━━━━
Le boost sera arrêté après le cycle en cours.
        `.trim());
      } else {
        await sendMessage(senderId, `
⚠️ 𝗔𝘂𝗰𝘂𝗻 𝗯𝗼𝗼𝘀𝘁 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀 ⚠️
━━━━━━━━━━━━━━━━━━━
Aucun boost actif à arrêter.

💡 Utilise : boost <lien_tiktok>
        `.trim());
      }
      return;
    }

    if (input.toLowerCase() === 'status') {
      if (userSession.isRunning) {
        await sendMessage(senderId, `
📊 𝗦𝗧𝗔𝗧𝗨𝗧 𝗗𝗨 𝗕𝗢𝗢𝗦𝗧 📊
━━━━━━━━━━━━━━━━━━━
✅ Succès : ${userSession.success || 0}
❌ Échecs : ${userSession.failed || 0}
👁️ Vues totales : ${(userSession.totalViews || 0).toLocaleString()}
❤️ Likes totaux : ${(userSession.totalLikes || 0).toLocaleString()}

🔗 URL : ${userSession.targetUrl || 'N/A'}

💡 Envoie "boost stop" pour arrêter
        `.trim());
      } else {
        await sendMessage(senderId, `
📊 𝗦𝗧𝗔𝗧𝗨𝗧 𝗗𝗨 𝗕𝗢𝗢𝗦𝗧 📊
━━━━━━━━━━━━━━━━━━━
⏸️ Aucun boost en cours.

💡 Utilise : boost <lien_tiktok>
        `.trim());
      }
      return;
    }

    if (!input || input === '') {
      await sendMessage(senderId, `
🚀 𝗧𝗜𝗞𝗧𝗢𝗞 𝗕𝗢𝗢𝗦𝗧𝗘𝗥 🚀
━━━━━━━━━━━━━━━━━━━
Booste tes vidéos TikTok avec des vues et des likes !

📝 𝗖𝗼𝗺𝗺𝗲𝗻𝘁 𝘂𝘁𝗶𝗹𝗶𝘀𝗲𝗿 :
boost <lien_tiktok>

💡 𝗘𝘅𝗲𝗺𝗽𝗹𝗲𝘀 :
• boost https://vt.tiktok.com/ZSfPPXu3C/
• boost https://vm.tiktok.com/abc123/
• boost https://tiktok.com/@user/video/123

📊 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝗲𝘀 :
• boost status - Voir le statut actuel
• boost stop - Arrêter le boost

⚡ Chaque boost ajoute +100 vues et +100 likes !
      `.trim());
      return;
    }

    if (!input.includes('tiktok.com')) {
      await sendMessage(senderId, `
❌ 𝗟𝗶𝗲𝗻 𝗶𝗻𝘃𝗮𝗹𝗶𝗱𝗲 ❌
━━━━━━━━━━━━━━━━━━━
Le lien doit être un lien TikTok valide.

💡 𝗙𝗼𝗿𝗺𝗮𝘁𝘀 𝗮𝗰𝗰𝗲𝗽𝘁𝗲́𝘀 :
• https://vt.tiktok.com/...
• https://vm.tiktok.com/...
• https://tiktok.com/@user/video/...
      `.trim());
      return;
    }

    if (userSession.isRunning) {
      await sendMessage(senderId, `
⚠️ 𝗕𝗼𝗼𝘀𝘁 𝗱𝗲́𝗷𝗮̀ 𝗲𝗻 𝗰𝗼𝘂𝗿𝘀 ⚠️
━━━━━━━━━━━━━━━━━━━
Un boost est déjà actif pour ton compte.

📊 Statut actuel :
✅ Succès : ${userSession.success || 0}
👁️ Vues : ${(userSession.totalViews || 0).toLocaleString()}
❤️ Likes : ${(userSession.totalLikes || 0).toLocaleString()}

💡 Envoie "boost stop" pour arrêter le boost actuel.
      `.trim());
      return;
    }

    await sendMessage(senderId, `
🔄 𝗣𝗥𝗘́𝗣𝗔𝗥𝗔𝗧𝗜𝗢𝗡 𝗗𝗨 𝗕𝗢𝗢𝗦𝗧 🔄
━━━━━━━━━━━━━━━━━━━
⏳ Résolution de l'URL...
    `.trim());

    const targetUrl = await prepareUrl(input);

    userBoostSessions.set(senderId, {
      isRunning: true,
      shouldStop: false,
      targetUrl: targetUrl,
      success: 0,
      failed: 0,
      totalViews: 0,
      totalLikes: 0,
      consecutiveFails: 0
    });

    await sendMessage(senderId, `
🚀 𝗕𝗢𝗢𝗦𝗧 𝗟𝗔𝗡𝗖𝗘́ ! 🚀
━━━━━━━━━━━━━━━━━━━
🔗 URL : ${targetUrl}

⚡ +100 vues et +100 likes par cycle
📊 Je t'enverrai des mises à jour régulières

💡 Commandes :
• boost status - Voir le statut
• boost stop - Arrêter le boost
    `.trim());

    const maxBoosts = 20;
    let boostCount = 0;

    while (boostCount < maxBoosts) {
      const session = userBoostSessions.get(senderId);
      
      if (!session || session.shouldStop) {
        await sendMessage(senderId, `
🛑 𝗕𝗢𝗢𝗦𝗧 𝗔𝗥𝗥𝗘̂𝗧𝗘́ 🛑
━━━━━━━━━━━━━━━━━━━
📊 𝗥𝗲́𝘀𝘂𝗺𝗲́ 𝗳𝗶𝗻𝗮𝗹 :
✅ Boosts réussis : ${session?.success || 0}
❌ Échecs : ${session?.failed || 0}
👁️ Vues ajoutées : ${(session?.totalViews || 0).toLocaleString()}
❤️ Likes ajoutés : ${(session?.totalLikes || 0).toLocaleString()}

💡 Utilise "boost <lien>" pour un nouveau boost
        `.trim());
        userBoostSessions.delete(senderId);
        return;
      }

      const result = await boostOnce(targetUrl);

      if (result.success) {
        session.success++;
        session.totalViews += 100;
        session.totalLikes += 100;
        session.consecutiveFails = 0;
        userBoostSessions.set(senderId, session);

        if (session.success % 5 === 0) {
          await sendMessage(senderId, `
📊 𝗠𝗜𝗦𝗘 𝗔̀ 𝗝𝗢𝗨𝗥 📊
━━━━━━━━━━━━━━━━━━━
✅ Boosts réussis : ${session.success}
👁️ Vues : +${session.totalViews.toLocaleString()}
❤️ Likes : +${session.totalLikes.toLocaleString()}
⏳ En cours...
          `.trim());
        }
      } else {
        session.failed++;
        session.consecutiveFails++;
        userBoostSessions.set(senderId, session);

        if (session.consecutiveFails >= 5) {
          await sendMessage(senderId, `
⚠️ Trop d'échecs consécutifs, pause de 5 secondes...
          `.trim());
          await new Promise(resolve => setTimeout(resolve, 5000));
          session.consecutiveFails = 0;
          userBoostSessions.set(senderId, session);
        }
      }

      boostCount++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const finalSession = userBoostSessions.get(senderId);
    await sendMessage(senderId, `
✅ 𝗕𝗢𝗢𝗦𝗧 𝗧𝗘𝗥𝗠𝗜𝗡𝗘́ ! ✅
━━━━━━━━━━━━━━━━━━━
📊 𝗥𝗲́𝘀𝘂𝗺𝗲́ 𝗳𝗶𝗻𝗮𝗹 :
✅ Boosts réussis : ${finalSession?.success || 0}
❌ Échecs : ${finalSession?.failed || 0}
👁️ Vues ajoutées : ${(finalSession?.totalViews || 0).toLocaleString()}
❤️ Likes ajoutés : ${(finalSession?.totalLikes || 0).toLocaleString()}

🔗 URL boostée : ${targetUrl}

💡 Utilise "boost <lien>" pour un nouveau boost
    `.trim());

    userBoostSessions.delete(senderId);

  } catch (error) {
    console.error('Erreur commande boost:', error.message);
    userBoostSessions.delete(senderId);
    
    await sendMessage(senderId, `
❌ 𝗘𝗥𝗥𝗘𝗨𝗥 ❌
━━━━━━━━━━━━━━━━━━━
Une erreur est survenue : ${error.message}

🔄 Réessaie dans quelques instants.
    `.trim());
  }
};

module.exports.info = {
  name: "boost",
  description: "Booste tes vidéos TikTok avec des vues et des likes automatiques.",
  usage: "Envoie 'boost <lien_tiktok>' pour booster une vidéo TikTok."
};
