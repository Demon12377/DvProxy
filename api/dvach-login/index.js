
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
        console.warn(`${timestamp} [api/dvach-login] Content-Type not application/json. Attempting to read body as text for passcode.`);
        try {
          let body = '';
          for await (const chunk of req) { body += chunk; }
          const params = new URLSearchParams(body); 
          purchasedPasscode = params.get('purchased_passcode');
           if(!purchasedPasscode && body.startsWith("{")) { 
              purchasedPasscode = JSON.parse(body).purchased_passcode;
          }
        } catch (parseError) {
           console.error(`${timestamp} [api/dvach-login] Error parsing non-JSON request body:`, parseError);
           res.setHeader('Content-Type', 'application/json');
           return res.status(400).json({ result: 0, error: {code: -1009, message: "Invalid request body format. Please send JSON with 'purchased_passcode' or ensure correct form data."}});
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
    loginFormData.append('json', '1'); 

    const loginUrl = `${DVACH_BASE_URL}/user/passlogin`;
    let loginResponse;

    try {
      loginResponse = await fetch(loginUrl, {
        method: 'POST',
        body: loginFormData, 
        headers: {
          ...loginFormData.getHeaders(), 
          'User-Agent': clientUserAgent,
          'Accept': 'application/json', 
        },
      });
    } catch (fetchLoginError) {
      console.error(`${timestamp} [api/dvach-login] Network error calling Dvach /user/passlogin:`, fetchLoginError);
      res.setHeader('Content-Type', 'application/json');
      return res.status(502).json({ result: 0, error: { code: -1007, message: `Error connecting to Dvach for login: ${fetchLoginError.message}` } });
    }
    
    const loginResponseText = await loginResponse.text();
    console.log(`${timestamp} [api/dvach-login] Dvach login response status: ${loginResponse.status}, text (first 300): ${loginResponseText.substring(0,300)}`);
    
    if (loginResponse.status === 303) {
      const passcodeAuthCookieForRedirect = extractCookieValue(loginResponse.headers.raw()['set-cookie'], 'passcode_auth');
      const userCodeCookieForRedirect = extractCookieValue(loginResponse.headers.raw()['set-cookie'], 'usercode');
      if (passcodeAuthCookieForRedirect) {
        console.warn(`${timestamp} [api/dvach-login] Dvach login resulted in 303 redirect (likely success), cookies extracted.`);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
            result: 1, message: "Dvach login likely successful (redirected), cookies extracted.",
            passcode_auth_cookie_value: passcodeAuthCookieForRedirect,
            user_code_cookie_value: userCodeCookieForRedirect,
        });
      } else {
        console.error(`${timestamp} [api/dvach-login] Dvach login resulted in 303 redirect, but passcode_auth cookie was NOT found. This indicates a problem.`);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ 
            result: 0, 
            error: { code: -1008, message: "Dvach login redirected (implying success) but did not provide the necessary session cookie. Response: " + loginResponseText.substring(0,100) }
        });
      }
    }

    let loginJson;
    try {
      loginJson = JSON.parse(loginResponseText);
    } catch (e) {
      console.error(`${timestamp} [api/dvach-login] Dvach login response was not JSON: ${loginResponseText.substring(0,200)}. Status: ${loginResponse.status}`);
      res.setHeader('Content-Type', 'application/json');
      if (!loginResponse.ok) { 
          return res.status(loginResponse.status).json({ result: 0, error: { code: loginResponse.status, message: `Dvach login request failed: ${loginResponseText.substring(0,100)}` } });
      }
      return res.status(500).json({ result: 0, error: { code: -1006, message: `Dvach login response was OK but not valid JSON. Response: ${loginResponseText.substring(0,100)}` } });
    }

    if (loginJson.error && typeof loginJson.error.code === 'number' && typeof loginJson.error.message === 'string') {
        console.error(`${timestamp} [api/dvach-login] Dvach login failed with structured error. Code: ${loginJson.error.code}, Message: ${loginJson.error.message}`);
        res.setHeader('Content-Type', 'application/json');
        return res.status(401).json({
            result: 0,
            error: { code: loginJson.error.code, message: `Dvach login error: ${loginJson.error.message}` }
        });
    }
   
    if (!loginResponse.ok) { 
       const loginErrorMsg = loginJson.reason || loginJson.Error || loginResponseText.substring(0,100) || `Login failed with status ${loginResponse.status}`;
       console.error(`${timestamp} [api/dvach-login] Dvach login failed. Status: ${loginResponse.status}. Message: ${loginErrorMsg}`);
       res.setHeader('Content-Type', 'application/json');
       return res.status(loginResponse.status).json({ result: 0, error: { code: -1003, message: `Dvach login failed: ${loginErrorMsg}` } });
    }
    
    if (loginJson.result !== 1 && loginJson.result !== 2) { 
      const errMsg = loginJson.reason || loginJson.Error || "Passcode login did not return success or active status (result != 1 or 2).";
      console.error(`${timestamp} [api/dvach-login] Dvach login response indicates failure: ${errMsg}. Full JSON:`, loginJson);
      res.setHeader('Content-Type', 'application/json');
      return res.status(401).json({ result: 0, error: { code: -1004, message: `Dvach login error: ${errMsg}` } });
    }

    const passcodeAuthCookie = extractCookieValue(loginResponse.headers.raw()['set-cookie'], 'passcode_auth');
    const userCodeCookie = extractCookieValue(loginResponse.headers.raw()['set-cookie'], 'usercode');

    if (!passcodeAuthCookie) {
      console.error(`${timestamp} [api/dvach-login] CRITICAL: Dvach login response was success/active (result: ${loginJson.result}), but no passcode_auth cookie was set.`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ result: 0, error: { code: -1005, message: "Dvach login succeeded (or was already active) but no passcode_auth cookie was set in response." } });
    }
    
    console.log(`${timestamp} [api/dvach-login] Dvach login successful. Cookies obtained. passcode_auth: OK, usercode: ${userCodeCookie || 'MISSING'}`);
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      result: loginJson.result, 
      message: loginJson.message || "Dvach login successful.",
      passcode_auth_cookie_value: passcodeAuthCookie,
      user_code_cookie_value: userCodeCookie, 
    });

  } catch (unhandledError) {
    const errorTimestamp = new Date().toISOString();
    console.error(`${errorTimestamp} [api/dvach-login] CRITICAL UNHANDLED ERROR in handler:`, unhandledError);
    try {
      // Ensure Content-Type is application/json for this catch-all
      // Check if headers are already sent before trying to set them.
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json');
      }
      
      const errorMessage = unhandledError instanceof Error ? unhandledError.message : 'Unknown unhandled error';
      // Sanitize errorMessage to ensure it's JSON-safe and not too long
      const safeErrorMessage = String(errorMessage).substring(0, 500); 

      // Check if headers are already sent before trying to send status/JSON.
      if (!res.headersSent) {
        return res.status(500).json({
          result: 0,
          error: { code: -5000, message: `An unexpected server error occurred in /api/dvach-login. Details: ${safeErrorMessage}` }
        });
      } else {
        // If headers are already sent, we can't send a new JSON response.
        // Log this specific situation. Vercel will likely close the connection or send its default error.
        console.error(`${errorTimestamp} [api/dvach-login] Headers already sent. Could not send JSON 500 for unhandled error.`);
      }
    } catch (finalCatchError) {
      // If even attempting to send the JSON 500 response fails.
      console.error(`${errorTimestamp} [api/dvach-login] FAILED TO SEND JSON 500 RESPONSE in final catch:`, finalCatchError);
      // Vercel will handle sending a generic 500 HTML page.
    }
  }
}
