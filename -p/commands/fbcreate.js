const fs = require("fs");
const axios = require("axios");
const crypto = require("crypto");
const sendMessage = require('../handles/sendMessage');
require('dotenv').config();

module.exports = async (senderId, args) => {
    try {
        const amount = parseInt(args, 10);

        if (isNaN(amount) || amount <= 0) {
            await sendMessage(senderId, "❌ Nombre invalide de comptes demandés. Veuillez spécifier un nombre entier positif.");
            return;
        }

        if (amount > 5) {
            await sendMessage(senderId, "⚠️ Pour des raisons de performance, vous ne pouvez créer que 5 comptes maximum à la fois.");
            return;
        }

        await sendMessage(senderId, `🚀 Création de ${amount} compte(s) Facebook... Veuillez patienter.`);

        const accounts = [];
        for (let i = 0; i < amount; i++) {
            const account = await createTempMailAccount();
            if (account) {
                const regData = await registerFacebookAccount(
                    account.email, 
                    account.password, 
                    account.firstName, 
                    account.lastName, 
                    account.birthday
                );
                if (regData && regData.new_user_id) {
                    console.log(`[⏳] Récupération du code de vérification pour ${account.email}...`);
                    await sendMessage(senderId, `⏳ Compte créé. Récupération du code de vérification...`);
                    
                    const verificationCode = await getVerificationCode(account.email);
                    
                    let accountStatus = 'Non confirmé';
                    let finalToken = regData.session_info ? regData.session_info.access_token : 'N/A';
                    
                    if (verificationCode) {
                        console.log(`[✓] Code de vérification reçu: ${verificationCode}`);
                        const confirmResult = await confirmFacebookAccount(verificationCode, regData.new_user_id);
                        
                        if (confirmResult && !confirmResult.error_msg) {
                            accountStatus = 'Confirmé ✅';
                            if (confirmResult.access_token) {
                                finalToken = confirmResult.access_token;
                            }
                            console.log(`[✓] Compte confirmé avec succès: ${account.email}`);
                            
                            await sendMessage(senderId, `⏳ Vérification du compte et résolution automatique des CAPTCHAs...`);
                            const loginResult = await loginToFacebookAndSolveCaptcha(account.email, account.password);
                            
                            if (loginResult.success) {
                                accountStatus = 'Vérifié et Prêt ✅✅';
                                console.log(`[✓✓] Compte vérifié et prêt à utiliser: ${account.email}`);
                            } else {
                                accountStatus = 'Confirmé (CAPTCHA non résolu)';
                                console.log(`[!] Compte confirmé mais CAPTCHA non résolu: ${loginResult.message}`);
                            }
                        } else {
                            accountStatus = 'Échec confirmation';
                            console.error(`[×] Échec de confirmation: ${confirmResult ? confirmResult.error_msg : 'Unknown'}`);
                        }
                    } else {
                        accountStatus = 'Code non reçu';
                        console.error(`[×] Code de vérification non reçu pour ${account.email}`);
                    }
                    
                    accounts.push({
                        email: account.email,
                        password: account.password,
                        firstName: account.firstName,
                        lastName: account.lastName,
                        birthday: account.birthday.toISOString().split('T')[0],
                        gender: regData.gender,
                        userId: regData.new_user_id,
                        token: finalToken,
                        status: accountStatus,
                    });
                } else {
                    const errorMsg = regData && regData.error_msg ? regData.error_msg : 'Raison inconnue';
                    const errorCode = regData && regData.error_code ? regData.error_code : 'N/A';
                    console.error(`FB Registration failed for ${account.email}: ${errorMsg} (Code: ${errorCode})`);
                    await sendMessage(senderId, `⚠️ Échec de l'enregistrement du compte: ${account.email}\nRaison: ${errorMsg}`);
                }
            } else {
                await sendMessage(senderId, `⚠️ Échec de la création de l'e-mail pour le compte ${i + 1}.`);
            }
        }

        if (accounts.length > 0) {
            let resultMessage = `🎉 Comptes créés avec succès:\n━━━━━━━━━━━━━━\n`;
            accounts.forEach((acc, index) => {
                resultMessage += `\n${index + 1}. 👤 ${acc.firstName} ${acc.lastName}\n`;
                resultMessage += `   📧 Email: ${acc.email}\n`;
                resultMessage += `   🔑 Mot de passe: ${acc.password}\n`;
                resultMessage += `   🎂 Date de naissance: ${acc.birthday}\n`;
                resultMessage += `   🆔 User ID: ${acc.userId}\n`;
                resultMessage += `   📊 Statut: ${acc.status}\n`;
                if (acc.token && acc.token !== 'N/A' && typeof acc.token === 'string') {
                    resultMessage += `   🔐 Token: ${acc.token.substring(0, 20)}...\n`;
                }
                resultMessage += `━━━━━━━━━━━━━━\n`;
            });
            await sendMessage(senderId, resultMessage);
        } else {
            await sendMessage(senderId, "❌ Aucun compte n'a été créé avec succès.");
        }
    } catch (error) {
        console.error('Erreur fbcreate:', error);
        const errorDetails = error.response ? JSON.stringify(error.response.data) : error.message;
        console.error('Détails de l\'erreur:', errorDetails);
        await sendMessage(senderId, `❌ Une erreur s'est produite lors de la création des comptes Facebook.\n\nDétails: ${error.message}\n\nVeuillez réessayer.`);
    }
};

const genRandomString = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const getRandomDate = (start, end) => {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const getRandomName = () => {
    const names = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Laura', 'Robert', 'Emily', 'William', 'Emma'];
    const surnames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    return {
        firstName: names[Math.floor(Math.random() * names.length)],
        lastName: surnames[Math.floor(Math.random() * surnames.length)],
    };
};

const createTempMailAccount = async () => {
    const url = 'https://api-test-liart-alpha.vercel.app/create';
    const password = genRandomString(12);
    const birthday = getRandomDate(new Date(1976, 0, 1), new Date(2004, 0, 1));
    const { firstName, lastName } = getRandomName();
    
    try {
        const response = await axios.get(url);
        if (response.data && response.data.address && response.data.token) {
            const email = response.data.address;
            const token = response.data.token;
            console.log(`[✓] E-mail Created: ${email}`);
            return { email, password, firstName, lastName, birthday, token };
        } else {
            console.error(`[×] Email Error: Invalid response`);
            return null;
        }
    } catch (error) {
        console.error(`[×] Error creating email: ${error.message}`);
        return null;
    }
};

const getVerificationCode = async (email, maxAttempts = 10) => {
    const url = `https://api-test-liart-alpha.vercel.app/inbox?message=${encodeURIComponent(email)}`;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const response = await axios.get(url);
            if (response.data && response.data.emails && response.data.emails.length > 0) {
                const emails = response.data.emails;
                
                for (const emailObj of emails) {
                    if (emailObj.subject && emailObj.subject.includes('confirmation code')) {
                        const codeMatch = emailObj.subject.match(/(\d{5,6})/);
                        if (codeMatch) {
                            const code = codeMatch[1];
                            console.log(`[✓] Verification code found: ${code}`);
                            return code;
                        }
                        
                        if (emailObj.body) {
                            const bodyCodeMatch = emailObj.body.match(/(\d{5,6})/);
                            if (bodyCodeMatch) {
                                const code = bodyCodeMatch[1];
                                console.log(`[✓] Verification code found in body: ${code}`);
                                return code;
                            }
                        }
                    }
                }
            }
            console.log(`[⏳] Attempt ${attempt}/${maxAttempts}: Waiting for verification email...`);
        } catch (error) {
            console.error(`[×] Error checking inbox (attempt ${attempt}): ${error.message}`);
        }
    }
    
    console.error(`[×] No verification code found after ${maxAttempts} attempts`);
    return null;
};

const solveCaptchaWithCapSolver = async (imageBase64OrUrl) => {
    const apiKey = process.env.CAPSOLVER_API_KEY;
    
    if (!apiKey) {
        console.error('[×] CAPSOLVER_API_KEY not found in environment variables');
        return null;
    }

    try {
        console.log('[⏳] Preparing CAPTCHA image for CapSolver...');
        
        let base64Image = '';
        
        if (imageBase64OrUrl.startsWith('http')) {
            console.log('[⏳] Downloading CAPTCHA image from URL...');
            const imageResponse = await axios.get(imageBase64OrUrl, { responseType: 'arraybuffer' });
            base64Image = Buffer.from(imageResponse.data, 'binary').toString('base64');
            console.log(`[✓] Image downloaded and converted to base64`);
        } else if (imageBase64OrUrl.startsWith('data:image')) {
            const base64Match = imageBase64OrUrl.match(/base64,(.+)/);
            if (base64Match) {
                base64Image = base64Match[1];
                console.log('[✓] Extracted base64 from data URL');
            } else {
                console.error('[×] Failed to extract base64 from data URL');
                return null;
            }
        } else {
            base64Image = imageBase64OrUrl;
        }
        
        console.log('[⏳] Sending CAPTCHA to CapSolver...');
        
        const createTaskPayload = {
            clientKey: apiKey,
            task: {
                type: 'ImageToTextTask',
                body: base64Image,
                module: 'common',
                score: 0.8,
                case: false
            }
        };

        const createResponse = await axios.post('https://api.capsolver.com/createTask', createTaskPayload);
        
        if (createResponse.data.errorId !== 0) {
            console.error(`[×] CapSolver Error (${createResponse.data.errorId}): ${createResponse.data.errorDescription}`);
            console.error(`[×] Error code: ${createResponse.data.errorCode}`);
            return null;
        }

        const taskId = createResponse.data.taskId;
        console.log(`[✓] Task created: ${taskId}`);

        for (let attempt = 1; attempt <= 30; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const resultPayload = {
                clientKey: apiKey,
                taskId: taskId
            };

            const resultResponse = await axios.post('https://api.capsolver.com/getTaskResult', resultPayload);
            
            if (resultResponse.data.errorId !== 0) {
                console.error(`[×] CapSolver Result Error: ${resultResponse.data.errorDescription}`);
                return null;
            }
            
            if (resultResponse.data.status === 'ready') {
                const solution = resultResponse.data.solution.text;
                console.log(`[✓] CAPTCHA solved: ${solution}`);
                return solution;
            }
            
            if (resultResponse.data.status === 'failed') {
                console.error('[×] CapSolver failed to solve CAPTCHA');
                return null;
            }
            
            console.log(`[⏳] Attempt ${attempt}/30: Waiting for CAPTCHA solution...`);
        }
        
        console.error('[×] CAPTCHA solving timeout');
        return null;
    } catch (error) {
        console.error(`[×] CapSolver Error: ${error.message}`);
        if (error.response) {
            console.error(`[×] Response data:`, JSON.stringify(error.response.data));
        }
        return null;
    }
};

const loginToFacebookAndSolveCaptcha = async (email, password) => {
    let browser;
    try {
        const puppeteer = require('puppeteer');
        
        console.log('[⏳] Launching browser for Facebook login...');
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('[⏳] Navigating to Facebook login page...');
        await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle0', timeout: 30000 });
        
        console.log('[⏳] Entering credentials...');
        await page.type('#email', email, { delay: 100 });
        await page.type('#pass', password, { delay: 100 });
        
        await page.click('button[name="login"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const captchaDetected = await page.evaluate(() => {
            const captchaText = document.body.innerText.toLowerCase();
            return captchaText.includes('confirm you\'re human') || 
                   captchaText.includes('enter the text') ||
                   captchaText.includes('security check') ||
                   document.querySelector('input[name="captcha_response"]') !== null;
        });

        if (captchaDetected) {
            console.log('[!] CAPTCHA detected! Attempting to solve...');
            
            let captchaImageData = null;
            
            try {
                const captchaImgSelector = await page.evaluate(() => {
                    const selectors = [
                        'img[alt*="captcha"]',
                        'img[src*="captcha"]', 
                        'img[alt*="security"]',
                        'div[role="img"] img',
                        'canvas'
                    ];
                    
                    for (const selector of selectors) {
                        const el = document.querySelector(selector);
                        if (el) {
                            return selector;
                        }
                    }
                    return null;
                });

                if (captchaImgSelector) {
                    console.log(`[✓] Found CAPTCHA element: ${captchaImgSelector}`);
                    
                    const element = await page.$(captchaImgSelector);
                    if (element) {
                        const screenshot = await element.screenshot({ encoding: 'base64' });
                        captchaImageData = screenshot;
                        console.log('[✓] CAPTCHA screenshot captured');
                    } else {
                        const imgSrc = await page.evaluate(() => {
                            const img = document.querySelector('img[alt*="captcha"], img[src*="captcha"], img[alt*="security"]');
                            return img ? img.src : null;
                        });
                        if (imgSrc) {
                            captchaImageData = imgSrc;
                            console.log('[✓] CAPTCHA image URL captured');
                        }
                    }
                }
            } catch (screenshotError) {
                console.error(`[!] Screenshot failed: ${screenshotError.message}, trying alternative method`);
                const imgSrc = await page.evaluate(() => {
                    const img = document.querySelector('img');
                    return img ? img.src : null;
                });
                if (imgSrc) captchaImageData = imgSrc;
            }

            if (captchaImageData) {
                console.log('[⏳] Sending CAPTCHA to solver...');
                const solution = await solveCaptchaWithCapSolver(captchaImageData);
                
                if (solution) {
                    console.log(`[✓] CAPTCHA solution received: ${solution}`);
                    
                    const inputFilled = await page.evaluate((text) => {
                        const possibleSelectors = [
                            'input[type="text"]',
                            'input[name*="captcha"]',
                            'input[aria-label*="text"]',
                            'input[placeholder*="text"]'
                        ];
                        
                        for (const selector of possibleSelectors) {
                            const input = document.querySelector(selector);
                            if (input && input.type === 'text') {
                                input.value = text;
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                return true;
                            }
                        }
                        return false;
                    }, solution);
                    
                    if (inputFilled) {
                        console.log('[✓] CAPTCHA solution entered into input field');
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        const buttonClicked = await page.evaluate(() => {
                            const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                            const continueBtn = buttons.find(btn => 
                                btn.textContent.toLowerCase().includes('continue') ||
                                btn.textContent.toLowerCase().includes('submit') ||
                                btn.type === 'submit'
                            );
                            if (continueBtn) {
                                continueBtn.click();
                                return true;
                            }
                            return false;
                        });
                        
                        if (buttonClicked) {
                            console.log('[✓] Submit button clicked');
                            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            const stillHasCaptcha = await page.evaluate(() => {
                                const captchaText = document.body.innerText.toLowerCase();
                                return captchaText.includes('confirm you\'re human') || 
                                       captchaText.includes('enter the text');
                            });
                            
                            if (!stillHasCaptcha) {
                                console.log('[✓✓] Login successful after CAPTCHA resolution!');
                                await browser.close();
                                return { success: true, message: 'Account verified and ready to use' };
                            } else {
                                console.log('[!] CAPTCHA still present - solution may be incorrect');
                                await browser.close();
                                return { success: false, message: 'CAPTCHA solution may be incorrect' };
                            }
                        }
                    }
                    
                    await browser.close();
                    return { success: false, message: 'Could not submit CAPTCHA solution' };
                } else {
                    await browser.close();
                    return { success: false, message: 'Failed to solve CAPTCHA' };
                }
            } else {
                console.log('[!] CAPTCHA detected but image could not be captured');
                await browser.close();
                return { success: false, message: 'CAPTCHA image not found' };
            }
        } else {
            console.log('[✓] No CAPTCHA detected - login successful!');
            await browser.close();
            return { success: true, message: 'Login successful without CAPTCHA' };
        }
        
    } catch (error) {
        console.error(`[×] Browser automation error: ${error.message}`);
        if (browser) await browser.close();
        return { success: false, message: error.message };
    }
};

const confirmFacebookAccount = async (code, userId) => {
    const api_key = '882a8490361da98702bf97a021ddc14d';
    const secret = '62f8ce9f74b12f84c123cc23437a4a32';
    
    const req = {
        api_key: api_key,
        code: code,
        format: 'json',
        method: 'auth.confirmPhone',
        uid: userId,
    };
    
    const sig = Object.keys(req).sort().map(k => `${k}=${req[k]}`).join('') + secret;
    const ensig = crypto.createHash('md5').update(sig).digest('hex');
    req.sig = ensig;

    const api_url = 'https://b-api.facebook.com/method/auth.confirmPhone';
    try {
        const response = await axios.post(api_url, new URLSearchParams(req), {
            headers: { 
                'User-Agent': '[FBAN/FB4A;FBAV/35.0.0.48.273;FBDM/{density=1.33125,width=800,height=1205};FBLC/en_US;FBCR/;FBPN/com.facebook.katana;FBDV/Nexus 7;FBSV/4.1.1;FBBK/0;]' 
            }
        });
        console.log(`[✓] Account confirmed successfully`);
        return response.data;
    } catch (error) {
        console.error(`[×] Confirmation Error: ${error.message}`);
        return null;
    }
};

const registerFacebookAccount = async (email, password, firstName, lastName, birthday) => {
    const api_key = '882a8490361da98702bf97a021ddc14d';
    const secret = '62f8ce9f74b12f84c123cc23437a4a32';
    const gender = Math.random() < 0.5 ? 'M' : 'F';
    const req = {
        api_key: api_key,
        attempt_login: true,
        birthday: birthday.toISOString().split('T')[0],
        client_country_code: 'EN',
        fb_api_caller_class: 'com.facebook.registration.protocol.RegisterAccountMethod',
        fb_api_req_friendly_name: 'registerAccount',
        firstname: firstName,
        format: 'json',
        gender: gender,
        lastname: lastName,
        email: email,
        locale: 'en_US',
        method: 'user.register',
        password: password,
        reg_instance: genRandomString(32),
        return_multiple_errors: true,
    };
    const sig = Object.keys(req).sort().map(k => `${k}=${req[k]}`).join('') + secret;
    const ensig = crypto.createHash('md5').update(sig).digest('hex');
    req.sig = ensig;

    const api_url = 'https://b-api.facebook.com/method/user.register';
    try {
        const response = await axios.post(api_url, new URLSearchParams(req), {
            headers: { 
                'User-Agent': '[FBAN/FB4A;FBAV/35.0.0.48.273;FBDM/{density=1.33125,width=800,height=1205};FBLC/en_US;FBCR/;FBPN/com.facebook.katana;FBDV/Nexus 7;FBSV/4.1.1;FBBK/0;]' 
            }
        });
        const reg = response.data;
        if (reg && reg.error_msg) {
            console.error(`[×] FB API Error for ${email}: ${reg.error_msg} (Code: ${reg.error_code})`);
        } else {
            console.log(`[✓] Registration Success for ${email}`);
        }
        return reg;
    } catch (error) {
        console.error(`[×] Registration Error: ${error.message}`);
        if (error.response) {
            console.error(`[×] Response data:`, error.response.data);
        }
        return { error_msg: error.message, error_code: 'NETWORK_ERROR' };
    }
};

module.exports.info = {
    name: "fbcreate",
    description: "Crée des comptes Facebook en utilisant des adresses e-mail générées aléatoirement.",
    usage: "fbcreate <nombre> (max 5)"
};
