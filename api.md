const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';

const BASE_URL = 'https://bible-en-ligne.net';
const MYMEMORY_API = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK_SIZE = 450;

async function translateText(text, sourceLang = 'fr', targetLang = 'mg') {
  try {
    const response = await axios.get(MYMEMORY_API, {
      params: {
        q: text,
        langpair: `${sourceLang}|${targetLang}`
      },
      timeout: 10000
    });
    
    if (response.data && response.data.responseData) {
      return response.data.responseData.translatedText;
    }
    return text;
  } catch (error) {
    console.error(`Erreur de traduction: ${error.message}`);
    return text;
  }
}

function splitTextIntoChunks(text, maxSize = MAX_CHUNK_SIZE) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (sentence.length > maxSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const words = sentence.split(' ');
      let wordChunk = '';
      for (const word of words) {
        if ((wordChunk + ' ' + word).length > maxSize) {
          if (wordChunk) chunks.push(wordChunk.trim());
          wordChunk = word;
        } else {
          wordChunk = wordChunk ? wordChunk + ' ' + word : word;
        }
      }
      if (wordChunk) chunks.push(wordChunk.trim());
    } else if ((currentChunk + ' ' + sentence).length > maxSize) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks.length > 0 ? chunks : [text];
}

async function translateWithChunking(text) {
  if (!text || text.length === 0) return '';
  
  if (text.length <= MAX_CHUNK_SIZE) {
    return await translateText(text);
  }
  
  const chunks = splitTextIntoChunks(text);
  const translatedChunks = [];
  
  for (const chunk of chunks) {
    const translated = await translateText(chunk);
    translatedChunks.push(translated);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return translatedChunks.join(' ');
}

async function translateVerses(verses) {
  const versets_francais = verses.map(v => ({
    chapitre: v.chapitre,
    verset: v.verset,
    texte: v.texte
  }));
  
  const versets_malagasy = [];
  
  for (const verse of verses) {
    const translatedText = await translateWithChunking(verse.texte);
    versets_malagasy.push({
      chapitre: verse.chapitre,
      verset: verse.verset,
      texte: translatedText
    });
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  
  return {
    francais: versets_francais,
    malagasy: versets_malagasy
  };
}

const bibleStructure = {
  "Ancien Testament": {
    "Le Pentateuque": [
      { nom: "Genèse", slug: "genese", code: "01O" },
      { nom: "Exode", slug: "exode", code: "02O" },
      { nom: "Lévitique", slug: "levitique", code: "03O" },
      { nom: "Nombres", slug: "nombres", code: "04O" },
      { nom: "Deutéronome", slug: "deuteronome", code: "05O" }
    ],
    "Les Livres historiques": [
      { nom: "Josué", slug: "josue", code: "06O" },
      { nom: "Juges", slug: "juges", code: "07O" },
      { nom: "Ruth", slug: "ruth", code: "08O" },
      { nom: "1 Samuel", slug: "1-samuel", code: "09O" },
      { nom: "2 Samuel", slug: "2-samuel", code: "10O" },
      { nom: "1 Rois", slug: "1-rois", code: "11O" },
      { nom: "2 Rois", slug: "2-rois", code: "12O" },
      { nom: "1 Chroniques", slug: "1-chroniques", code: "13O" },
      { nom: "2 Chroniques", slug: "2-chroniques", code: "14O" },
      { nom: "Esdras", slug: "esdras", code: "15O" },
      { nom: "Néhémie", slug: "nehemie", code: "16O" },
      { nom: "Esther", slug: "esther", code: "17O" }
    ],
    "Les Livres poétiques": [
      { nom: "Job", slug: "job", code: "18O" },
      { nom: "Psaumes", slug: "psaumes", code: "19O" },
      { nom: "Les Proverbes", slug: "les-proverbes", code: "20O" },
      { nom: "L'Ecclésiaste", slug: "l-ecclesiaste", code: "21O" },
      { nom: "Cantiques", slug: "cantiques", code: "22O" }
    ],
    "Les Prophètes": [
      { nom: "Esaïe", slug: "esaie", code: "23O" },
      { nom: "Jérémie", slug: "jeremie", code: "24O" },
      { nom: "Lamentations", slug: "lamentations", code: "25O" },
      { nom: "Ezéchiel", slug: "ezechiel", code: "26O" },
      { nom: "Daniel", slug: "daniel", code: "27O" },
      { nom: "Osée", slug: "osee", code: "28O" },
      { nom: "Joël", slug: "joel", code: "29O" },
      { nom: "Amos", slug: "amos", code: "30O" },
      { nom: "Abdias", slug: "abdias", code: "31O" },
      { nom: "Jonas", slug: "jonas", code: "32O" },
      { nom: "Michée", slug: "michee", code: "33O" },
      { nom: "Nahum", slug: "nahum", code: "34O" },
      { nom: "Habakuk", slug: "habakuk", code: "35O" },
      { nom: "Sophonie", slug: "sophonie", code: "36O" },
      { nom: "Aggée", slug: "agee", code: "37O" },
      { nom: "Zacharie", slug: "zacharie", code: "38O" },
      { nom: "Malachie", slug: "malachie", code: "39O" }
    ]
  },
  "Nouveau Testament": {
    "Les Evangiles": [
      { nom: "Matthieu", slug: "matthieu", code: "40N" },
      { nom: "Marc", slug: "marc", code: "41N" },
      { nom: "Luc", slug: "luc", code: "42N" },
      { nom: "Jean", slug: "jean", code: "43N" }
    ],
    "Les Actes des Apôtres": [
      { nom: "Actes", slug: "actes", code: "44N" }
    ],
    "Les Epîtres de Paul": [
      { nom: "Romains", slug: "romains", code: "45N" },
      { nom: "1 Corinthiens", slug: "1-corinthiens", code: "46N" },
      { nom: "2 Corinthiens", slug: "2-corinthiens", code: "47N" },
      { nom: "Galates", slug: "galates", code: "48N" },
      { nom: "Ephésiens", slug: "ephesiens", code: "49N" },
      { nom: "Philipiens", slug: "philipiens", code: "50N" },
      { nom: "Colossiens", slug: "colossiens", code: "51N" },
      { nom: "1 Thessaloniciens", slug: "1-thessaloniciens", code: "52N" },
      { nom: "2 Thessaloniciens", slug: "2-thessaloniciens", code: "53N" },
      { nom: "1 Timothée", slug: "1-timothee", code: "54N" },
      { nom: "2 Timothée", slug: "2-timothee", code: "55N" },
      { nom: "Tite", slug: "tite", code: "56N" },
      { nom: "Philémon", slug: "philemon", code: "57N" },
      { nom: "Hébreux", slug: "hebreux", code: "58N" }
    ],
    "Les autres Epîtres": [
      { nom: "Jacques", slug: "jacques", code: "59N" },
      { nom: "1 Pierre", slug: "1-pierre", code: "60N" },
      { nom: "2 Pierre", slug: "2-pierre", code: "61N" },
      { nom: "1 Jean", slug: "1-jean", code: "62N" },
      { nom: "2 Jean", slug: "2-jean", code: "63N" },
      { nom: "3 Jean", slug: "3-jean", code: "64N" },
      { nom: "Jude", slug: "jude", code: "65N" }
    ],
    "Livre de la Révélation": [
      { nom: "Apocalypse", slug: "apocalypse", code: "66N" }
    ]
  }
};

async function scrapeBibleList() {
  try {
    const response = await axios.get(BASE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const result = {};
    let currentTestament = null;
    let currentCategory = null;
    
    $('h1, h2, ul li a').each((i, elem) => {
      const tagName = elem.tagName.toLowerCase();
      const text = $(elem).text().trim();
      
      if (tagName === 'h1') {
        if (text.includes('Ancien Testament') || text.includes('Nouveau Testament')) {
          currentTestament = text;
          result[currentTestament] = {};
        }
      } else if (tagName === 'h2' && currentTestament) {
        currentCategory = text;
        if (!result[currentTestament][currentCategory]) {
          result[currentTestament][currentCategory] = [];
        }
      } else if (tagName === 'a' && currentTestament && currentCategory) {
        const href = $(elem).attr('href');
        if (href && href.includes('bible,')) {
          result[currentTestament][currentCategory].push(text);
        }
      }
    });
    
    if (Object.keys(result).length > 0) {
      return { success: true, data: result };
    }
    return { success: false, data: null };
  } catch (error) {
    console.error(`Erreur lors du scraping de la liste: ${error.message}`);
    return { success: false, data: null };
  }
}

function getFallbackList() {
  const result = {};
  for (const testament of Object.keys(bibleStructure)) {
    result[testament] = {};
    for (const category of Object.keys(bibleStructure[testament])) {
      result[testament][category] = bibleStructure[testament][category].map(book => book.nom);
    }
  }
  return result;
}

function findBookByName(searchName) {
  const normalizedSearch = searchName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const testament of Object.keys(bibleStructure)) {
    for (const category of Object.keys(bibleStructure[testament])) {
      for (const book of bibleStructure[testament][category]) {
        const normalizedBook = book.nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (normalizedBook.includes(normalizedSearch) || normalizedSearch.includes(normalizedBook)) {
          return { ...book, testament, category };
        }
      }
    }
  }
  return null;
}

async function scrapeChapter(bookCode, bookSlug, chapter) {
  try {
    const url = `${BASE_URL}/bible,${bookCode}-${chapter},${bookSlug}.php`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const verses = [];
    
    $('p').each((i, elem) => {
      const text = $(elem).text().trim();
      const verseMatch = text.match(/^(\d+):(\d+)\s+(.+)$/);
      if (verseMatch) {
        verses.push({
          chapitre: parseInt(verseMatch[1]),
          verset: parseInt(verseMatch[2]),
          texte: verseMatch[3].trim()
        });
      }
    });
    
    return verses;
  } catch (error) {
    console.error(`Erreur lors du scraping: ${error.message}`);
    return [];
  }
}

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

app.get('/', (req, res) => {
  res.json({
    message: "API Bible VAOVAO",
    endpoints: {
      liste: "GET /recherche?bible=liste - Affiche la structure complète de la Bible (scrapée dynamiquement)",
      livre: "GET /recherche?titre={nom_du_livre}&page={chapitre} - Affiche les versets d'un chapitre",
      versets_specifiques: "GET /recherche?texte={livre}&chapitre={num}&verset={debut}:{fin} - Affiche des versets spécifiques",
      versets_compacts: "GET /recherche?texte={livre} {chapitre} {verset_debut}:{verset_fin} - Format compact"
    },
    exemples: {
      liste: "/recherche?bible=liste",
      genese_chapitre_1: "/recherche?titre=genese&page=1",
      matthieu_chapitre_5: "/recherche?titre=matthieu&page=5",
      jeremie_versets_1_a_5: "/recherche?texte=Jérémie&chapitre=1&verset=1:5",
      jeremie_format_compact: "/recherche?texte=Jérémie 1 1:5",
      jean_verset_unique: "/recherche?texte=Jean&chapitre=3&verset=16"
    }
  });
});

function parseVerseRange(versetParam) {
  if (!versetParam) return null;
  
  const versetStr = versetParam.toString().trim();
  
  if (versetStr.includes(':')) {
    const parts = versetStr.split(':');
    const start = parseInt(parts[0]);
    const end = parseInt(parts[1]);
    if (!isNaN(start) && !isNaN(end)) {
      return { start, end };
    }
  } else if (versetStr.includes('-')) {
    const parts = versetStr.split('-');
    const start = parseInt(parts[0]);
    const end = parseInt(parts[1]);
    if (!isNaN(start) && !isNaN(end)) {
      return { start, end };
    }
  } else {
    const single = parseInt(versetStr);
    if (!isNaN(single)) {
      return { start: single, end: single };
    }
  }
  return null;
}

function parseCompactFormat(texte) {
  if (!texte) return null;
  
  const text = texte.toString().trim();
  
  const matchWithVerse = text.match(/^(.+?)\s+(\d+)\s+(\d+)[:\-](\d+)$/);
  if (matchWithVerse) {
    return {
      livre: matchWithVerse[1].trim(),
      chapitre: parseInt(matchWithVerse[2]),
      versetStart: parseInt(matchWithVerse[3]),
      versetEnd: parseInt(matchWithVerse[4])
    };
  }
  
  const matchSingleVerse = text.match(/^(.+?)\s+(\d+)\s+(\d+)$/);
  if (matchSingleVerse) {
    return {
      livre: matchSingleVerse[1].trim(),
      chapitre: parseInt(matchSingleVerse[2]),
      versetStart: parseInt(matchSingleVerse[3]),
      versetEnd: parseInt(matchSingleVerse[3])
    };
  }
  
  const matchChapterOnly = text.match(/^(.+?)\s+(\d+)$/);
  if (matchChapterOnly) {
    return {
      livre: matchChapterOnly[1].trim(),
      chapitre: parseInt(matchChapterOnly[2]),
      versetStart: null,
      versetEnd: null
    };
  }
  
  return {
    livre: text,
    chapitre: null,
    versetStart: null,
    versetEnd: null
  };
}

app.get('/recherche', async (req, res) => {
  const { bible, titre, page, texte, chapitre, verset } = req.query;
  
  if (bible === 'liste') {
    const scraped = await scrapeBibleList();
    
    if (scraped.success) {
      return res.json(scraped.data);
    } else {
      return res.json(getFallbackList());
    }
  }
  
  if (texte) {
    let bookName, chapterNum, versetStart, versetEnd;
    
    if (chapitre) {
      bookName = texte;
      chapterNum = parseInt(chapitre);
      
      if (verset) {
        const range = parseVerseRange(verset);
        if (range) {
          versetStart = range.start;
          versetEnd = range.end;
        }
      }
    } else {
      const parsed = parseCompactFormat(texte);
      if (parsed) {
        bookName = parsed.livre;
        chapterNum = parsed.chapitre || 1;
        versetStart = parsed.versetStart;
        versetEnd = parsed.versetEnd;
      } else {
        bookName = texte;
        chapterNum = 1;
      }
    }
    
    const book = findBookByName(bookName);
    
    if (!book) {
      return res.status(404).json({
        erreur: "Livre non trouvé",
        message: `Le livre "${bookName}" n'a pas été trouvé. Utilisez /recherche?bible=liste pour voir la liste des livres disponibles.`
      });
    }
    
    const verses = await scrapeChapter(book.code, book.slug, chapterNum);
    
    if (verses.length === 0) {
      return res.status(404).json({
        erreur: "Chapitre non trouvé",
        message: `Le chapitre ${chapterNum} du livre "${book.nom}" n'a pas été trouvé ou n'existe pas.`
      });
    }
    
    let filteredVerses = verses;
    if (versetStart !== null && versetStart !== undefined) {
      filteredVerses = verses.filter(v => v.verset >= versetStart && v.verset <= versetEnd);
      
      if (filteredVerses.length === 0) {
        return res.status(404).json({
          erreur: "Versets non trouvés",
          message: `Les versets ${versetStart} à ${versetEnd} du chapitre ${chapterNum} de "${book.nom}" n'ont pas été trouvés.`,
          versets_disponibles: verses.map(v => v.verset)
        });
      }
    }
    
    const translated = await translateVerses(filteredVerses);
    
    return res.json({
      livre: book.nom,
      testament: book.testament,
      categorie: book.category,
      chapitre: chapterNum,
      verset_debut: versetStart || 1,
      verset_fin: versetEnd || filteredVerses[filteredVerses.length - 1]?.verset,
      total_versets: filteredVerses.length,
      versets_francais: translated.francais,
      versets_malagasy: translated.malagasy
    });
  }
  
  if (titre) {
    const book = findBookByName(titre);
    
    if (!book) {
      return res.status(404).json({
        erreur: "Livre non trouvé",
        message: `Le livre "${titre}" n'a pas été trouvé. Utilisez /recherche?bible=liste pour voir la liste des livres disponibles.`
      });
    }
    
    const chapter = parseInt(page) || 1;
    const verses = await scrapeChapter(book.code, book.slug, chapter);
    
    if (verses.length === 0) {
      return res.status(404).json({
        erreur: "Chapitre non trouvé",
        message: `Le chapitre ${chapter} du livre "${book.nom}" n'a pas été trouvé ou n'existe pas.`
      });
    }
    
    const translated = await translateVerses(verses);
    
    return res.json({
      livre: book.nom,
      testament: book.testament,
      categorie: book.category,
      chapitre: chapter,
      total_versets: verses.length,
      versets_francais: translated.francais,
      versets_malagasy: translated.malagasy
    });
  }
  
  return res.status(400).json({
    erreur: "Paramètres manquants",
    message: "Utilisez ?bible=liste pour la liste des livres, ?titre={livre}&page={chapitre} pour les versets, ou ?texte={livre}&chapitre={num}&verset={debut}:{fin} pour des versets spécifiques"
  });
});

app.listen(PORT, HOST, () => {
  console.log(`API Bible VAOVAO démarrée sur http://${HOST}:${PORT}`);
  console.log('Routes disponibles:');
  console.log('  GET / - Documentation de l\'API');
  console.log('  GET /recherche?bible=liste - Liste des livres (scraping dynamique)');
  console.log('  GET /recherche?titre={livre}&page={chapitre} - Versets d\'un chapitre');
  console.log('  GET /recherche?texte={livre}&chapitre={num}&verset={debut}:{fin} - Versets spécifiques');
  console.log('  GET /recherche?texte={livre} {chapitre} {verset_debut}:{verset_fin} - Format compact');
});
