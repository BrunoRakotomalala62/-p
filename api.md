const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const CHUNK_SIZE = 24 * 1024 * 1024;
const TEMP_DIR = '/tmp/temp_chunks';

try {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
} catch (e) {}

const partitionCache = new Map();

app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Video Scraper - Documentation</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Fira+Code&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%);
      min-height: 100vh;
      color: #e0e0e0;
      overflow-x: hidden;
    }
    
    .stars {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    }
    
    .star {
      position: absolute;
      background: white;
      border-radius: 50%;
      animation: twinkle 2s infinite;
    }
    
    @keyframes twinkle {
      0%, 100% { opacity: 0.3; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.2); }
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 20px;
      position: relative;
      z-index: 1;
    }
    
    header {
      text-align: center;
      margin-bottom: 60px;
      animation: fadeInDown 1s ease-out;
    }
    
    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    h1 {
      font-size: 3rem;
      font-weight: 700;
      background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
      background-size: 300% 300%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradient 4s ease infinite;
      margin-bottom: 15px;
    }
    
    @keyframes gradient {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    
    .subtitle {
      color: #a0a0a0;
      font-size: 1.2rem;
      font-weight: 300;
    }
    
    .endpoint-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 30px;
      backdrop-filter: blur(10px);
      transition: all 0.4s ease;
      animation: fadeInUp 0.8s ease-out;
      animation-fill-mode: both;
    }
    
    .endpoint-card:nth-child(1) { animation-delay: 0.2s; }
    .endpoint-card:nth-child(2) { animation-delay: 0.4s; }
    .endpoint-card:nth-child(3) { animation-delay: 0.6s; }
    
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(40px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .endpoint-card:hover {
      transform: translateY(-5px);
      border-color: rgba(255, 107, 107, 0.5);
      box-shadow: 0 20px 60px rgba(255, 107, 107, 0.15);
    }
    
    .method {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.85rem;
      margin-right: 10px;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(72, 219, 251, 0.4); }
      50% { box-shadow: 0 0 20px 5px rgba(72, 219, 251, 0.2); }
    }
    
    .get { background: linear-gradient(135deg, #48dbfb, #0abde3); color: #000; }
    
    .endpoint-path {
      font-family: 'Fira Code', monospace;
      font-size: 1.1rem;
      color: #feca57;
    }
    
    .endpoint-title {
      font-size: 1.5rem;
      margin: 20px 0 10px;
      color: #fff;
    }
    
    .endpoint-desc {
      color: #a0a0a0;
      margin-bottom: 20px;
      line-height: 1.6;
    }
    
    .params-title {
      color: #ff6b6b;
      font-weight: 600;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .params-title::before {
      content: '';
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #ff6b6b;
      border-radius: 50%;
      animation: blink 1.5s infinite;
    }
    
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    
    .param {
      display: flex;
      gap: 15px;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .param:last-child { border-bottom: none; }
    
    .param-name {
      font-family: 'Fira Code', monospace;
      color: #48dbfb;
      min-width: 100px;
    }
    
    .param-desc { color: #b0b0b0; }
    
    .param-required {
      color: #ff6b6b;
      font-size: 0.8rem;
      font-weight: 500;
    }
    
    .example-box {
      background: rgba(0, 0, 0, 0.4);
      border-radius: 12px;
      padding: 20px;
      margin-top: 20px;
      border-left: 4px solid #ff9ff3;
      position: relative;
      overflow: hidden;
    }
    
    .example-box::before {
      content: 'EXEMPLE';
      position: absolute;
      top: 10px;
      right: 15px;
      font-size: 0.7rem;
      color: #ff9ff3;
      font-weight: 600;
      letter-spacing: 2px;
    }
    
    .example-label {
      color: #ff9ff3;
      font-weight: 500;
      margin-bottom: 10px;
    }
    
    .example-code {
      font-family: 'Fira Code', monospace;
      background: rgba(0, 0, 0, 0.3);
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.9rem;
      color: #48dbfb;
      word-break: break-all;
    }
    
    .response-box {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      padding: 15px;
      margin-top: 15px;
      font-family: 'Fira Code', monospace;
      font-size: 0.85rem;
      color: #a0d995;
      white-space: pre-wrap;
    }
    
    .glow-orb {
      position: fixed;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      filter: blur(100px);
      opacity: 0.15;
      pointer-events: none;
      z-index: 0;
    }
    
    .orb1 {
      background: #ff6b6b;
      top: -100px;
      right: -100px;
      animation: float1 8s ease-in-out infinite;
    }
    
    .orb2 {
      background: #48dbfb;
      bottom: -100px;
      left: -100px;
      animation: float2 10s ease-in-out infinite;
    }
    
    .orb3 {
      background: #ff9ff3;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      animation: float3 12s ease-in-out infinite;
    }
    
    @keyframes float1 {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(-50px, 50px); }
    }
    
    @keyframes float2 {
      0%, 100% { transform: translate(0, 0); }
      50% { transform: translate(50px, -50px); }
    }
    
    @keyframes float3 {
      0%, 100% { transform: translate(-50%, -50%) scale(1); }
      50% { transform: translate(-50%, -50%) scale(1.2); }
    }
    
    footer {
      text-align: center;
      margin-top: 60px;
      padding: 30px;
      color: #606060;
      font-size: 0.9rem;
      animation: fadeIn 1s ease-out 1s both;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    .version-badge {
      display: inline-block;
      background: linear-gradient(135deg, #ff6b6b, #ff9ff3);
      color: #000;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-left: 10px;
    }
  </style>
</head>
<body>
  <div class="glow-orb orb1"></div>
  <div class="glow-orb orb2"></div>
  <div class="glow-orb orb3"></div>
  
  <div class="stars" id="stars"></div>
  
  <div class="container">
    <header>
      <h1>API Video Scraper</h1>
      <p class="subtitle">Documentation et Guide d'Utilisation <span class="version-badge">v1.0</span></p>
    </header>
    
    <div class="endpoint-card">
      <div>
        <span class="method get">GET</span>
        <span class="endpoint-path">/recherche</span>
      </div>
      <h2 class="endpoint-title">Rechercher des videos</h2>
      <p class="endpoint-desc">Permet de rechercher des videos par mot-cle avec pagination.</p>
      
      <div class="params-title">Parametres</div>
      <div class="param">
        <span class="param-name">video</span>
        <span class="param-desc">Mot-cle de recherche <span class="param-required">(requis)</span></span>
      </div>
      <div class="param">
        <span class="param-name">uid</span>
        <span class="param-desc">Identifiant utilisateur (optionnel)</span>
      </div>
      <div class="param">
        <span class="param-name">page</span>
        <span class="param-desc">Numero de page (defaut: 1)</span>
      </div>
      
      <div class="example-box">
        <div class="example-label">Requete</div>
        <div class="example-code">GET /recherche?video=Kitty&uid=123&page=1</div>
        <div class="response-box">{
  "recherche": "Kitty",
  "uid": "123",
  "page": 1,
  "total_pages": 10,
  "total_videos": 27,
  "videos": [
    {
      "id": "abc123",
      "titre": "Titre de la video",
      "image_url": "https://...",
      "url_page": "https://..."
    }
  ]
}</div>
      </div>
    </div>
    
    <div class="endpoint-card">
      <div>
        <span class="method get">GET</span>
        <span class="endpoint-path">/video/:id</span>
      </div>
      <h2 class="endpoint-title">Details d'une video</h2>
      <p class="endpoint-desc">Recupere les informations detaillees d'une video specifique incluant les URLs de streaming.</p>
      
      <div class="params-title">Parametres</div>
      <div class="param">
        <span class="param-name">id</span>
        <span class="param-desc">Identifiant de la video <span class="param-required">(requis, dans l'URL)</span></span>
      </div>
      <div class="param">
        <span class="param-name">slug</span>
        <span class="param-desc">Slug de la video (optionnel)</span>
      </div>
      
      <div class="example-box">
        <div class="example-label">Requete</div>
        <div class="example-code">GET /video/abc123?slug=nom_video</div>
        <div class="response-box">{
  "id": "abc123",
  "titre": "Titre de la video",
  "url_hls": "https://..../video.m3u8",
  "url_mp4": "https://..../video.mp4"
}</div>
      </div>
    </div>
    
    <div class="endpoint-card">
      <div>
        <span class="method get">GET</span>
        <span class="endpoint-path">/stream</span>
      </div>
      <h2 class="endpoint-title">Telecharger une video</h2>
      <p class="endpoint-desc">Permet de telecharger directement une video en streaming via son URL MP4.</p>
      
      <div class="params-title">Parametres</div>
      <div class="param">
        <span class="param-name">url_mp4</span>
        <span class="param-desc">URL directe du fichier MP4 <span class="param-required">(requis)</span></span>
      </div>
      <div class="param">
        <span class="param-name">filename</span>
        <span class="param-desc">Nom du fichier de sortie (optionnel)</span>
      </div>
      
      <div class="example-box">
        <div class="example-label">Requete</div>
        <div class="example-code">GET /stream?url_mp4=https://example.com/video.mp4&filename=ma_video.mp4</div>
        <div class="response-box">// Retourne le fichier video en telechargement direct
// Content-Type: video/mp4
// Content-Disposition: attachment; filename="ma_video.mp4"</div>
      </div>
    </div>
    
    <div class="endpoint-card">
      <div>
        <span class="method get" style="background: linear-gradient(135deg, #ff6b6b, #ee5a24);">GET</span>
        <span class="endpoint-path">/partition</span>
      </div>
      <h2 class="endpoint-title">Partitionner une video volumineuse</h2>
      <p class="endpoint-desc">Decoupe une video de plus de 24 Mo en plusieurs parties telechargeable separement. Ideal pour les telephones avec limite de telechargement.</p>
      
      <div class="params-title">Parametres</div>
      <div class="param">
        <span class="param-name">url_mp4</span>
        <span class="param-desc">URL directe du fichier MP4 <span class="param-required">(requis)</span></span>
      </div>
      <div class="param">
        <span class="param-name">filename</span>
        <span class="param-desc">Nom de base pour les fichiers (optionnel)</span>
      </div>
      
      <div class="example-box">
        <div class="example-label">Requete</div>
        <div class="example-code">GET /partition?url_mp4=https://example.com/big_video.mp4&filename=ma_video</div>
        <div class="response-box">{
  "message": "Video partitionnee avec succes",
  "taille_totale": "72.50 Mo",
  "taille_max_partie": "24 Mo",
  "partitions": 3,
  "fichiers": [
    {
      "partie": 1,
      "taille": "24.00 Mo",
      "nom_fichier": "ma_video_partie1.mp4",
      "url_telechargement": "https://.../chunk/abc123/1?filename=ma_video_partie1.mp4"
    },
    {
      "partie": 2,
      "taille": "24.00 Mo",
      "nom_fichier": "ma_video_partie2.mp4",
      "url_telechargement": "https://.../chunk/abc123/2?filename=ma_video_partie2.mp4"
    },
    {
      "partie": 3,
      "taille": "24.50 Mo",
      "nom_fichier": "ma_video_partie3.mp4",
      "url_telechargement": "https://.../chunk/abc123/3?filename=ma_video_partie3.mp4"
    }
  ],
  "instructions": "Telechargez chaque partie..."
}</div>
      </div>
      <p style="color: #feca57; margin-top: 15px; font-size: 0.9rem;">Les fichiers sont disponibles pendant 30 minutes apres le partitionnement.</p>
    </div>
    
    <footer>
      Cree avec passion | API Video Scraper
    </footer>
  </div>
  
  <script>
    const starsContainer = document.getElementById('stars');
    for (let i = 0; i < 100; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.width = Math.random() * 3 + 1 + 'px';
      star.style.height = star.style.width;
      star.style.animationDelay = Math.random() * 2 + 's';
      star.style.animationDuration = (Math.random() * 2 + 1) + 's';
      starsContainer.appendChild(star);
    }
  </script>
</body>
</html>
  `;
  res.setHeader('Cache-Control', 'no-cache');
  res.send(html);
});

app.get('/recherche', async (req, res) => {
  const { video, uid, page } = req.query;
  const baseUrl = `https://${req.get('host')}`;
  
  if (!video) {
    return res.status(400).json({ error: 'Le paramètre video est requis' });
  }
  
  const currentPage = parseInt(page) || 1;
  const pageParam = currentPage > 1 ? `&p=${currentPage - 1}` : '';
  
  try {
    const searchUrl = `https://fr.xvideos.com/?k=${encodeURIComponent(video)}${pageParam}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(response.data);
    const videos = [];
    
    let totalPages = 1;
    const lastPageLink = $('.pagination .last-page').first();
    if (lastPageLink.length) {
      const pageText = lastPageLink.text().trim();
      totalPages = parseInt(pageText) || 1;
    }
    
    $('.thumb-block').each((index, element) => {
      const $el = $(element);
      const id = $el.attr('id');
      
      if (id && id.startsWith('video_')) {
        const videoId = id.replace('video_', '');
        const titleEl = $el.find('.title a');
        const title = titleEl.attr('title') || titleEl.text().trim();
        const videoPageUrl = titleEl.attr('href');
        
        const imgEl = $el.find('.thumb img');
        let imageUrl = imgEl.attr('data-src') || imgEl.attr('src');
        
        if (imageUrl) {
          imageUrl = imageUrl.replace('/thumbs169/', '/thumbs169lll/');
        }
        
        const slug = videoPageUrl ? videoPageUrl.split('/').pop() : '';
        
        if (title && videoPageUrl) {
          videos.push({
            id: videoId,
            titre: title,
            image_url: imageUrl || null,
            url_page: `https://fr.xvideos.com${videoPageUrl}`,
            url_details: `${baseUrl}/video/${videoId}?slug=${encodeURIComponent(slug)}`,
            url_telechargement_direct: `${baseUrl}/download/${videoId}?slug=${encodeURIComponent(slug)}`
          });
        }
      }
    });
    
    res.json({
      recherche: video,
      uid: uid || null,
      page: currentPage,
      total_pages: totalPages,
      total_videos: videos.length,
      videos: videos
    });
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Erreur lors du scraping',
      message: error.message 
    });
  }
});

app.get('/video/:id', async (req, res) => {
  const { id } = req.params;
  const { slug } = req.query;
  const baseUrl = `https://${req.get('host')}`;
  
  try {
    const videoPageUrl = `https://fr.xvideos.com/video.${id}/${slug || '_'}`;
    
    const response = await axios.get(videoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = response.data;
    
    const hlsMatch = html.match(/setVideoHLS\(['"]([^'"]+)['"]\)/);
    const mp4Match = html.match(/html5player\.setVideoUrlHigh\(['"]([^'"]+)['"]\)/) || 
                     html.match(/html5player\.setVideoUrlLow\(['"]([^'"]+)['"]\)/);
    
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const titre = titleMatch ? titleMatch[1].replace(' - XVIDEOS.COM', '').trim() : 'video';
    const safeFilename = titre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
    
    const mp4Url = mp4Match ? mp4Match[1] : null;
    
    res.json({
      id: id,
      titre: titre,
      url_hls: hlsMatch ? hlsMatch[1] : null,
      url_mp4: mp4Url,
      url_telechargement: mp4Url ? `${baseUrl}/stream?url_mp4=${encodeURIComponent(mp4Url)}&filename=${safeFilename}.mp4` : null,
      url_telechargement_direct: `${baseUrl}/download/${id}?slug=${encodeURIComponent(slug || '')}`,
      url_partition: mp4Url ? `${baseUrl}/partition?url_mp4=${encodeURIComponent(mp4Url)}&filename=${safeFilename}` : null
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Erreur lors de la récupération de la vidéo',
      message: error.message
    });
  }
});

app.get('/download/:id', async (req, res) => {
  const { id } = req.params;
  const { slug } = req.query;
  
  try {
    const videoPageUrl = `https://fr.xvideos.com/video.${id}/${slug || '_'}`;
    
    const pageResponse = await axios.get(videoPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = pageResponse.data;
    const mp4Match = html.match(/html5player\.setVideoUrlHigh\(['"]([^'"]+)['"]\)/) || 
                     html.match(/html5player\.setVideoUrlLow\(['"]([^'"]+)['"]\)/);
    
    if (!mp4Match) {
      return res.status(404).json({ error: 'URL video non trouvee' });
    }
    
    const mp4Url = mp4Match[1];
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const titre = titleMatch ? titleMatch[1].replace(' - XVIDEOS.COM', '').trim() : 'video';
    const safeFilename = titre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50) + '.mp4';
    
    const videoResponse = await axios({
      method: 'GET',
      url: mp4Url,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fr.xvideos.com/'
      }
    });
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    
    if (videoResponse.headers['content-length']) {
      res.setHeader('Content-Length', videoResponse.headers['content-length']);
    }
    
    videoResponse.data.pipe(res);
    
  } catch (error) {
    res.status(500).json({
      error: 'Erreur lors du telechargement',
      message: error.message
    });
  }
});

app.get('/stream', async (req, res) => {
  const { url_mp4, filename } = req.query;
  
  if (!url_mp4) {
    return res.status(400).json({ error: 'Le paramètre url_mp4 est requis' });
  }
  
  try {
    const videoFilename = filename || `video_${Date.now()}.mp4`;
    
    const response = await axios({
      method: 'GET',
      url: url_mp4,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fr.xvideos.com/'
      }
    });
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${videoFilename}"`);
    
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    
    response.data.pipe(res);
    
  } catch (error) {
    res.status(500).json({
      error: 'Erreur lors du téléchargement de la vidéo',
      message: error.message
    });
  }
});

app.get('/partition', async (req, res) => {
  const { url_mp4, filename } = req.query;
  const baseUrl = `https://${req.get('host')}`;
  
  if (!url_mp4) {
    return res.status(400).json({ error: 'Le paramètre url_mp4 est requis' });
  }
  
  try {
    const urlHash = crypto.createHash('md5').update(url_mp4).digest('hex').substring(0, 8);
    
    if (partitionCache.has(urlHash)) {
      const cached = partitionCache.get(urlHash);
      return res.json(cached);
    }
    
    const headResponse = await axios.head(url_mp4, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fr.xvideos.com/'
      }
    });
    
    const totalSize = parseInt(headResponse.headers['content-length']) || 0;
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    if (totalSize <= CHUNK_SIZE) {
      const result = {
        message: 'Video trop petite pour etre partitionnee',
        taille_totale: `${totalSizeMB} Mo`,
        partitions: 1,
        fichiers: [{
          partie: 1,
          taille: `${totalSizeMB} Mo`,
          url_telechargement: `${baseUrl}/stream?url_mp4=${encodeURIComponent(url_mp4)}&filename=${filename || 'video'}.mp4`
        }]
      };
      return res.json(result);
    }
    
    const response = await axios({
      method: 'GET',
      url: url_mp4,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://fr.xvideos.com/'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    const videoBuffer = Buffer.from(response.data);
    const numChunks = Math.ceil(videoBuffer.length / CHUNK_SIZE);
    const baseFilename = filename || 'video';
    const fichiers = [];
    
    for (let i = 0; i < numChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, videoBuffer.length);
      const chunk = videoBuffer.slice(start, end);
      const chunkFilename = `${urlHash}_partie${i + 1}.mp4`;
      const chunkPath = path.join(TEMP_DIR, chunkFilename);
      
      fs.writeFileSync(chunkPath, chunk);
      
      const chunkSizeMB = (chunk.length / (1024 * 1024)).toFixed(2);
      
      fichiers.push({
        partie: i + 1,
        taille: `${chunkSizeMB} Mo`,
        nom_fichier: `${baseFilename}_partie${i + 1}.mp4`,
        url_telechargement: `${baseUrl}/chunk/${urlHash}/${i + 1}?filename=${baseFilename}_partie${i + 1}.mp4`
      });
    }
    
    const result = {
      message: 'Video partitionnee avec succes',
      taille_totale: `${totalSizeMB} Mo`,
      taille_max_partie: '24 Mo',
      partitions: numChunks,
      fichiers: fichiers,
      instructions: 'Telechargez chaque partie puis combinez-les avec un outil comme FFmpeg ou un combinateur de fichiers'
    };
    
    partitionCache.set(urlHash, result);
    
    setTimeout(() => {
      partitionCache.delete(urlHash);
      fichiers.forEach(f => {
        const chunkPath = path.join(TEMP_DIR, `${urlHash}_partie${f.partie}.mp4`);
        if (fs.existsSync(chunkPath)) {
          fs.unlinkSync(chunkPath);
        }
      });
    }, 30 * 60 * 1000);
    
    res.json(result);
    
  } catch (error) {
    res.status(500).json({
      error: 'Erreur lors du partitionnement de la video',
      message: error.message
    });
  }
});

app.get('/chunk/:hash/:part', (req, res) => {
  const { hash, part } = req.params;
  const { filename } = req.query;
  
  const chunkFilename = `${hash}_partie${part}.mp4`;
  const chunkPath = path.join(TEMP_DIR, chunkFilename);
  
  if (!fs.existsSync(chunkPath)) {
    return res.status(404).json({ 
      error: 'Fichier non trouve',
      message: 'Cette partie a expire ou n\'existe pas. Veuillez refaire la partition.'
    });
  }
  
  const stat = fs.statSync(chunkPath);
  const downloadFilename = filename || `video_partie${part}.mp4`;
  
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
  
  const readStream = fs.createReadStream(chunkPath);
  readStream.pipe(res);
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API démarrée sur le port ${PORT}`);
    console.log(`Endpoint: GET /recherche?video=Kitty&uid=123&page=1`);
    console.log(`Endpoint: GET /video/:id?slug=nom_video`);
    console.log(`Endpoint: GET /stream?url_mp4=...&filename=video.mp4`);
    console.log(`Endpoint: GET /partition?url_mp4=...&filename=video`);
  });
}

module.exports = app;