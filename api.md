const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 5000;

const signes = [
  { nom: "Bélier", slug: "belier" },
  { nom: "Taureau", slug: "taureau" },
  { nom: "Gémeaux", slug: "gemeaux" },
  { nom: "Cancer", slug: "cancer" },
  { nom: "Lion", slug: "lion" },
  { nom: "Vierge", slug: "vierge" },
  { nom: "Balance", slug: "balance" },
  { nom: "Scorpion", slug: "scorpion" },
  { nom: "Sagittaire", slug: "sagittaire" },
  { nom: "Capricorne", slug: "capricorne" },
  { nom: "Verseau", slug: "verseau" },
  { nom: "Poissons", slug: "poissons" }
];

const MYMEMORY_CHAR_LIMIT = 450;

function normalizeString(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function getSlugFromName(nom) {
  const normalizedNom = normalizeString(nom);
  const signe = signes.find(s => normalizeString(s.nom) === normalizedNom);
  return signe ? signe.slug : null;
}

function getSigneFromName(nom) {
  const normalizedNom = normalizeString(nom);
  return signes.find(s => normalizeString(s.nom) === normalizedNom);
}

function splitTextForTranslation(text, maxLength = MYMEMORY_CHAR_LIMIT) {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    let splitIndex = remainingText.lastIndexOf('. ', maxLength);

    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = remainingText.lastIndexOf(', ', maxLength);
    }

    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = remainingText.lastIndexOf(' ', maxLength);
    }

    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = maxLength;
    }

    const chunk = remainingText.substring(0, splitIndex + 1).trim();
    chunks.push(chunk);
    remainingText = remainingText.substring(splitIndex + 1).trim();
  }

  return chunks;
}

async function translateToMalagasy(text) {
  if (!text || text.trim() === '') {
    return '';
  }

  try {
    const chunks = splitTextForTranslation(text);
    const translatedChunks = [];

    for (const chunk of chunks) {
      const encodedText = encodeURIComponent(chunk);
      const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=fr|mg`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      if (response.data && response.data.responseData && response.data.responseData.translatedText) {
        translatedChunks.push(response.data.responseData.translatedText);
      } else {
        translatedChunks.push(chunk);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return translatedChunks.join(' ');
  } catch (error) {
    console.error('Erreur de traduction:', error.message);
    return text;
  }
}

async function translateHoroscopeData(horoscopeData) {
  const translatedData = {
    titre: await translateToMalagasy(horoscopeData.titre),
    sections: {}
  };

  for (const [key, value] of Object.entries(horoscopeData.sections)) {
    translatedData.sections[key] = await translateToMalagasy(value);
  }

  return translatedData;
}

async function scrapeHoroscope(slug) {
  const url = `https://www.20minutes.fr/horoscope/horoscope-${slug}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8'
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    let titre = '';
    $('h1, h2').each((i, el) => {
      const text = $(el).text().trim();
      if (text.toLowerCase().includes('horoscope') && text.match(/\d+\s*(novembre|décembre|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre)/i)) {
        titre = text;
        return false;
      }
    });

    if (!titre) {
      titre = $('h1').first().text().trim() || $('h2').first().text().trim();
    }

    const result = {
      titre: titre,
      sections: {}
    };

    const sectionPatterns = [
      { name: 'Amour', regex: />Amour<\/h3>.*?<p[^>]*class="[^"]*text[^"]*"[^>]*>([^<]+)<\/p>/s },
      { name: 'Argent et travail', regex: />Argent et travail<\/h3>.*?<p[^>]*class="[^"]*text[^"]*"[^>]*>([^<]+)<\/p>/s },
      { name: 'Santé', regex: />Santé<\/h3>.*?<p[^>]*class="[^"]*text[^"]*"[^>]*>([^<]+)<\/p>/s },
      { name: 'Humeur', regex: />Humeur<\/h3>.*?<p[^>]*class="[^"]*text[^"]*"[^>]*>([^<]+)<\/p>/s },
      { name: 'Conseil', regex: />Conseil<\/h3>.*?<p[^>]*class="[^"]*text[^"]*"[^>]*>([^<]+)<\/p>/s }
    ];

    for (const { name, regex } of sectionPatterns) {
      const match = html.match(regex);
      if (match) {
        let content = match[1].trim();
        content = content.replace(/&#x27;/g, "'");
        content = content.replace(/&quot;/g, '"');
        content = content.replace(/&amp;/g, '&');
        content = content.replace(/&lt;/g, '<');
        content = content.replace(/&gt;/g, '>');
        result.sections[name] = content;
      }
    }

    if (Object.keys(result.sections).length < 3) {
      const altPatterns = [
        { name: 'Amour', regex: /Amour[\s\S]{0,100}?<p[^>]*>([^<]{50,})<\/p>/i },
        { name: 'Argent et travail', regex: /Argent et travail[\s\S]{0,100}?<p[^>]*>([^<]{50,})<\/p>/i },
        { name: 'Santé', regex: /Santé[\s\S]{0,100}?<p[^>]*>([^<]{50,})<\/p>/i },
        { name: 'Humeur', regex: /Humeur[\s\S]{0,100}?<p[^>]*>([^<]{20,})<\/p>/i },
        { name: 'Conseil', regex: /Conseil[\s\S]{0,100}?<p[^>]*>([^<]{20,})<\/p>/i }
      ];

      for (const { name, regex } of altPatterns) {
        if (!result.sections[name]) {
          const match = html.match(regex);
          if (match) {
            let content = match[1].trim();
            content = content.replace(/&#x27;/g, "'");
            content = content.replace(/&quot;/g, '"');
            content = content.replace(/&amp;/g, '&');
            result.sections[name] = content;
          }
        }
      }
    }

    return result;

  } catch (error) {
    console.error('Erreur lors du scraping:', error.message);
    throw error;
  }
}

app.get('/recherche', async (req, res) => {
  const { horoscope, titre } = req.query;

  if (horoscope === 'liste') {
    const listeSignes = signes.map(s => s.nom);
    return res.json({
      success: true,
      data: listeSignes
    });
  }

  if (titre) {
    const signe = getSigneFromName(titre);

    if (!signe) {
      return res.status(400).json({
        success: false,
        error: `Signe "${titre}" non trouvé. Signes valides: ${signes.map(s => s.nom).join(', ')}`
      });
    }

    try {
      const horoscopeData = await scrapeHoroscope(signe.slug);

      const malagasyData = await translateHoroscopeData(horoscopeData);

      return res.json({
        success: true,
        signe: signe.nom,
        francais: {
          titre: horoscopeData.titre,
          sections: {
            Amour: horoscopeData.sections['Amour'] || '',
            "Argent et travail": horoscopeData.sections['Argent et travail'] || '',
            Santé: horoscopeData.sections['Santé'] || '',
            Humeur: horoscopeData.sections['Humeur'] || '',
            Conseil: horoscopeData.sections['Conseil'] || ''
          }
        },
        malagasy: {
          titre: malagasyData.titre,
          sections: {
            Fitiavana: malagasyData.sections['Amour'] || '',
            "Vola sy asa": malagasyData.sections['Argent et travail'] || '',
            Fahasalamana: malagasyData.sections['Santé'] || '',
            "Toe-tsaina": malagasyData.sections['Humeur'] || '',
            Torohevitra: malagasyData.sections['Conseil'] || ''
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: `Erreur lors de la récupération de l'horoscope: ${error.message}`
      });
    }
  }

  return res.status(400).json({
    success: false,
    error: "Paramètre manquant. Utilisez ?horoscope=liste ou ?titre=NomDuSigne",
    exemples: [
      "GET /recherche?horoscope=liste",
      "GET /recherche?titre=Lion",
      "GET /recherche?titre=Bélier"
    ]
  });
});

app.get('/', (req, res) => {
  res.json({
    message: "API Horoscope 20 Minutes - Français & Malagasy",
    endpoints: [
      {
        route: "GET /recherche?horoscope=liste",
        description: "Retourne la liste des 12 signes du zodiaque"
      },
      {
        route: "GET /recherche?titre=NomDuSigne",
        description: "Retourne l'horoscope du jour en français et en malgache",
        exemple: "/recherche?titre=Lion"
      }
    ],
    signesDisponibles: signes.map(s => s.nom),
    traduction: {
      source: "MyMemory API",
      langues: ["Français (fr)", "Malagasy (mg)"]
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur démarré sur http://0.0.0.0:${PORT}`);
  console.log('Routes disponibles:');
  console.log('  GET / - Documentation de l\'API');
  console.log('  GET /recherche?horoscope=liste - Liste des signes');
  console.log('  GET /recherche?titre=Lion - Horoscope d\'un signe (FR + MG)');
});