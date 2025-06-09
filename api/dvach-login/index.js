// api/dvach-login/index.js
import fetch from 'node-fetch';
import FormDataNode from 'form-data'; // Using FormData for Node.js environment

const DEFAULT_DVACH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
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
    return res.status(405).json({ result: 0, error: { code: 405, message: `Method Not Allowed. Only POST requests are accepted for /api/dvach-login. Received: ${req.method}` } });
  }

  // Vercel parses JSON body automatically if Content-Type is application/json
  // If sending FormData from client, need to parse it. For simplicity, assume JSON body.
  let purchasedPasscode;
  let clientUserAgent = req.headers['x-user-agent'] || DEFAULT_DVACH_USER_AGENT;

  if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
      purchasedPasscode = req.body.purchased_passcode;
  } else {
      // Fallback or specific parsing for FormData if client sends that for this endpoint
      // For now, strongly recommend client sends JSON for this simple request.
      console.warn(`${timestamp} [api/dvach-login] Content-Type not application/json. Attempting to read body as text for passcode.`);
      // This is a simplified way if not using formidable; for production, use formidable for FormData.
      // However, this endpoint is simple enough that client should send JSON.
      try {
        let body = '';
        for await (const chunk of req) {
            body += chunk;
        }
        const params = new URLSearchParams(body);
        purchasedPasscode = params.get('purchased_passcode');
         if(!purchasedPasscode && body.startsWith("{")) { // Simple JSON check
            purchasedPasscode = JSON.parse(body).purchased_passcode;
        }

      } catch (parseError) {
         console.error(`${timestamp} [api/dvach-login] Error parsing non-JSON request body:`, parseError);
         return res.status(400).json({ result: 0, error: {code: -1009, message: "Invalid request body format. Please send JSON with 'purchased_passcode'."}});
      }
  }


  if (!purchasedPasscode) {
    console.error(`${timestamp} [api/dvach-login] 'purchased_passcode' is missing from request body.`);
    return res.status(400).json({ result: 0, error: { code: -1001, message: "Dvach 'purchased_passcode' string is missing from request body." } });
  }

  console.log(`${timestamp} [api/dvach-login] Attempting Dvach login with purchased passcode...`);
  const loginFormData = new FormDataNode(); // Use FormData for Node.js to send to Dvach
  loginFormData.append('passcode', purchasedPasscode);

  const loginUrl = `${DVACH_BASE_URL}/user/passlogin?json=1`;
  let loginResponse;

  try {
    loginResponse = await fetch(loginUrl, {
      method: 'POST',
      body: loginFormData, // loginFormData is an instance of FormDataNode
      headers: {
        ...loginFormData.getHeaders(), // Important for multipart/form-data with boundary
        'User-Agent': clientUserAgent,
        'Accept': 'application/json',
      },
    });

    const loginResponseText = await loginResponse.text();
    console.log(`${timestamp} [api/dvach-login] Dvach login response status: ${loginResponse.status}, text (first 300): ${loginResponseText.substring(0,300)}`);
    
    let loginJson;
    try {
      loginJson = JSON.parse(loginResponseText);
    } catch (e) {
      console.error(`${timestamp} [api/dvach-login] Dvach login response was not JSON: ${loginResponseText.substring(0,200)}. Status: ${loginResponse.status}`);
      if (!loginResponse.ok) {
          return res.status(loginResponse.status).json({ result: 0, error: { code: loginResponse.status, message: `Dvach login request failed: ${loginResponseText.substring(0,100)}` } });
      }
      return res.status(500).json({ result: 0, error: { code: -1006, message: `Dvach login response was OK but not valid JSON. Response: ${loginResponseText.substring(0,100)}` } });
    }

    // Check for explicit errors from Dvach, even if status code might be 200 initially (e.g. error in JSON payload)
    if (loginJson.error && typeof loginJson.error.code === 'number' && typeof loginJson.error.message === 'string') {
        console.error(`${timestamp} [api/dvach-login] Dvach login failed with structured error. Code: ${loginJson.error.code}, Message: ${loginJson.error.message}`);
        return res.status(401).json({
            result: 0,
            error: {
                code: loginJson.error.code, 
                message: `Dvach login error: ${loginJson.error.message}`
            }
        });
    }
    // Handle other non-OK statuses if not already covered by structured error
    if (!loginResponse.ok && loginResponse.status !== 303) { // 303 can be a success redirect
       const loginErrorMsg = loginJson.reason || loginResponseText.substring(0,100) || `Login failed with status ${loginResponse.status}`;
       console.error(`${timestamp} [api/dvach-login] Dvach login failed. Status: ${loginResponse.status}. Message: ${loginErrorMsg}`);
       return res.status(401).json({ result: 0, error: { code: -1003, message: `Dvach login failed: ${loginErrorMsg}` } });
    }
    
    // Check the JSON response content for success indicators (result: 1 or 2)
    if (loginJson.result !== 1 && loginJson.result !== 2) { // result:2 is "passcode already active"
      const errMsg = loginJson.reason || "Passcode login did not return success or active status.";
      console.error(`${timestamp} [api/dvach-login] Dvach login response indicates failure: ${errMsg}`);
      return res.status(401).json({ result: 0, error: { code: -1004, message: `Dvach login error: ${errMsg}` } });
    }

    const passcodeAuthCookie = extractCookieValue(loginResponse.headers.raw()['set-cookie'], 'passcode_auth');
    const userCodeCookie = extractCookieValue(loginResponse.headers.raw()['set-cookie'], 'usercode');

    if (!passcodeAuthCookie) {
      console.error(`${timestamp} [api/dvach-login] CRITICAL: Dvach login response was success/active (result: ${loginJson.result}), but no passcode_auth cookie was set.`);
      return res.status(500).json({ result: 0, error: { code: -1005, message: "Dvach login succeeded (or was already active) but no passcode_auth cookie was set in response." } });
    }
    
    console.log(`${timestamp} [api/dvach-login] Dvach login successful. Cookies obtained. passcode_auth: ${passcodeAuthCookie ? 'OK' : 'MISSING'}, usercode: ${userCodeCookie || 'MISSING'}`);
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      result: 1,
      message: "Dvach login successful.",
      passcode_auth_cookie_value: passcodeAuthCookie,
      user_code_cookie_value: userCodeCookie, // Can be null
    });

  } catch (fetchLoginError) {
    console.error(`${timestamp} [api/dvach-login] Network or other error during Dvach login:`, fetchLoginError);
    res.setHeader('Content-Type', 'application/json');
    return res.status(502).json({ result: 0, error: { code: -1007, message: `Error connecting to Dvach for login: ${fetchLoginError.message}` } });
  }
}
