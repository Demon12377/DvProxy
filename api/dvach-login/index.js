// api/dvach-login/index.js
import fetch from 'node-fetch';
import FormDataNode from 'form-data'; // Using FormData for Node.js environment

const DEFAULT_DVACH_USER_AGENT_FOR_SERVERLESS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DVACH_BASE_URL = 'https://2ch.hk';

function extractCookieValue(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const cookieStr of cookies) {
    if (cookieStr.startsWith(`${cookieName}=`)) {
      return cookieStr.split(';')[0].split('=')[1];
    }
  }
  return null;
}

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [api/dvach-login] Request received. Method: ${req.method}, URL: ${req.url}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Agent');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'CORS preflight successful for /api/dvach-login' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.setHeader('Content-Type', 'application/json');
    return res.status(405).json({ result: 0, error: { code: 405, message: `Method Not Allowed. Only POST requests are accepted for /api/dvach-login. Received: ${req.method}` } });
  }

  try {
    let purchasedPasscode;
    const clientUserAgent = req.headers['x-user-agent'] || DEFAULT_DVACH_USER_AGENT_FOR_SERVERLESS;

    if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
        purchasedPasscode = req.body.purchased_passcode;
    } else {
        let body = '';
        for await (const chunk of req) { body += chunk; }
        try {
            const parsedBody = JSON.parse(body);
            purchasedPasscode = parsedBody.purchased_passcode;
        } catch (parseError) {
           console.error(`${timestamp} [api/dvach-login] Error parsing request body as JSON:`, parseError, "Body was:", body.substring(0,200));
           res.setHeader('Content-Type', 'application/json');
           return res.status(400).json({ result: 0, error: {code: -1009, message: "Invalid request body format. Please send JSON with 'purchased_passcode'."}});
        }
    }

    if (!purchasedPasscode) {
      console.error(`${timestamp} [api/dvach-login] 'purchased_passcode' is missing from request body.`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(400).json({ result: 0, error: { code: -1001, message: "Dvach 'purchased_passcode' string is missing from request body." } });
    }

    console.log(`${timestamp} [api/dvach-login] Attempting Dvach login with purchased passcode... UA: ${clientUserAgent}`);
    const loginFormData = new FormDataNode(); 
    loginFormData.append('passcode', purchasedPasscode);
    
    const loginUrl = `${DVACH_BASE_URL}/user/passlogin?json=1`; 
    let loginResponse;

    const dvachRequestHeaders = {
      ...loginFormData.getHeaders(), 
      'User-Agent': clientUserAgent,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
      'Referer': `${DVACH_BASE_URL}/`,
      'Origin': DVACH_BASE_URL,
      // Sec-Fetch-* headers removed for simplicity
    };

    try {
      loginResponse = await fetch(loginUrl, {
        method: 'POST',
        body: loginFormData, 
        headers: dvachRequestHeaders,
      });
    } catch (fetchLoginError) {
      console.error(`${timestamp} [api/dvach-login] Network error calling Dvach /user/passlogin:`, fetchLoginError);
      res.setHeader('Content-Type', 'application/json');
      return res.status(502).json({ result: 0, error: { code: -1007, message: `Error connecting to Dvach for login: ${fetchLoginError.message}` } });
    }
    
    const loginResponseText = await loginResponse.text();
    console.log(`${timestamp} [api/dvach-login] Dvach login response status: ${loginResponse.status}, text (first 300): ${loginResponseText.substring(0,300)}`);
    
    const passcodeAuthCookie = extractCookieValue(loginResponse.headers.raw()['set-cookie'], 'passcode_auth');
    const userCodeCookie = extractCookieValue(loginResponse.headers.raw()['set-cookie'], 'usercode');

    let loginJson;
    try {
      loginJson = JSON.parse(loginResponseText);
    } catch (e) {
      console.error(`${timestamp} [api/dvach-login] Dvach login response was not JSON: ${loginResponseText.substring(0,200)}. Status: ${loginResponse.status}`);
      if (passcodeAuthCookie) {
          console.warn(`${timestamp} [api/dvach-login] Dvach response not JSON, but passcode_auth cookie found. Proceeding with cookie.`);
          res.setHeader('Content-Type', 'application/json');
          return res.status(200).json({
              result: 1, 
              message: "Dvach response was not JSON, but session cookie found. Assuming login state.",
              passcode_auth_cookie_value: passcodeAuthCookie,
              user_code_cookie_value: userCodeCookie,
              dvach_raw_response_preview: loginResponseText.substring(0,200)
          });
      }
      res.setHeader('Content-Type', 'application/json');
      return res.status(loginResponse.status === 200 ? 500 : loginResponse.status)
                 .json({ result: 0, error: { code: -1006, message: `Dvach login response was not valid JSON (Status: ${loginResponse.status}). Response: ${loginResponseText.substring(0,100)}` } });
    }

    if (loginJson.error && typeof loginJson.error.code === 'number' && typeof loginJson.error.message === 'string') {
        console.error(`${timestamp} [api/dvach-login] Dvach login failed with structured error. Code: ${loginJson.error.code}, Message: ${loginJson.error.message}`);
        res.setHeader('Content-Type', 'application/json');
        return res.status(loginResponse.status).json({ 
            result: 0,
            error: { code: loginJson.error.code, message: `Dvach login error: ${loginJson.error.message}` }
        });
    }
   
    if (loginJson.result !== 1 && loginJson.result !== 2) { 
      const errMsg = loginJson.reason || loginJson.Error || "Passcode login did not return success or active status (result != 1 or 2).";
      console.error(`${timestamp} [api/dvach-login] Dvach login response indicates failure: ${errMsg}. Full JSON:`, loginJson);
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ result: 0, error: { code: loginJson.error?.code || -1004, message: `Dvach login error: ${errMsg}` } });
    }

    if (!passcodeAuthCookie) {
      console.error(`${timestamp} [api/dvach-login] CRITICAL: Dvach login response was success/active (result: ${loginJson.result}), but no passcode_auth cookie was set. This usually means the passcode was invalid or another issue occurred.`);
      res.setHeader('Content-Type', 'application/json');
      const dvachErrorReason = loginJson.reason || loginJson.Error || "Dvach login reported success/active but failed to provide session cookie.";
      return res.status(401).json({ result: 0, error: { code: loginJson.error?.code || -1005, message: dvachErrorReason } });
    }
    
    console.log(`${timestamp} [api/dvach-login] Dvach login successful. Cookies obtained. passcode_auth: OK, usercode: ${userCodeCookie || 'MISSING'}`);
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      result: loginJson.result, 
      message: loginJson.message || "Dvach login successful.",
      passcode_auth_cookie_value: passcodeAuthCookie,
      user_code_cookie_value: userCodeCookie, 
      passcode_details_from_dvach: loginJson.passcode 
    });

  } catch (unhandledError) {
    const errorTimestamp = new Date().toISOString();
    console.error(`${errorTimestamp} [api/dvach-login] CRITICAL UNHANDLED ERROR in handler:`, unhandledError);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      const errorMessage = unhandledError instanceof Error ? unhandledError.message : 'Unknown unhandled error';
      return res.status(500).json({ result: 0, error: { code: -5000, message: `Unexpected server error: ${errorMessage.substring(0,300)}` } });
    }
  }
}