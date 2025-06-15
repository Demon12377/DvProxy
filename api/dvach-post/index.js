// api/dvach-post/index.js
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormDataNode from 'form-data';

export const config = {
  api: {
    bodyParser: false, // Required for formidable to correctly parse multipart/form-data
  },
};

const DEFAULT_DVACH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DVACH_BASE_URL = 'https://2ch.hk';

export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [api/dvach-post] Request received. Method: ${req.method}, URL: ${req.url}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Agent');


  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'CORS preflight successful for /api/dvach-post' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ result: 0, error: { code: 405, message: `Method Not Allowed. Only POST requests are accepted. Received: ${req.method}` } });
  }

  const form = formidable({ multiples: false }); 

  try {
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, parsedFields, parsedFiles) => {
        if (err) {
          console.error(`${timestamp} [api/dvach-post] Error parsing form data:`, err);
          reject(new Error(`Form parsing error: ${err.message}`));
          return;
        }
        resolve([parsedFields, parsedFiles]);
      });
    });
    
    const getFieldValue = (fieldName) => {
      const value = fields[fieldName];
      const singleValue = Array.isArray(value) ? value[0] : value;
      return typeof singleValue === 'string' ? singleValue.trim() : singleValue;
    };

    const board = getFieldValue('board');
    const threadIdForDvach = getFieldValue('thread_id_for_dvach'); 
    const parentNumForDvach = getFieldValue('parent_num_for_dvach'); 
    const comment = getFieldValue('comment');
    const passcodeAuthCookieValue = getFieldValue('passcode_auth_cookie_value');
    const userCodeCookieValue = getFieldValue('user_code_cookie_value'); 
    const emailSage = getFieldValue('email'); 
    const clientUserAgent = req.headers['x-user-agent'] || DEFAULT_DVACH_USER_AGENT;


    if (!passcodeAuthCookieValue) {
      console.error(`${timestamp} [api/dvach-post] CRITICAL: passcode_auth_cookie_value is missing.`);
      return res.status(401).json({ result: 0, error: { code: -2001, message: 'Dvach session cookie (passcode_auth) is missing. Please login first.' } });
    }
    if (!board || !comment) { 
      const missingInfo = `Board: ${board || 'MISSING'}, Comment: ${comment ? 'Present' : 'MISSING'}`;
      console.log(`${timestamp} [api/dvach-post] Missing required fields. Details: ${missingInfo}`);
      return res.status(400).json({ result: 0, error: { code: -2002, message: `Missing required fields for posting. Details: ${missingInfo}` } });
    }
    
    console.log(`${timestamp} [api/dvach-post] Using provided session cookies to post to Dvach /user/posting... UA: ${clientUserAgent}`);
    const dvachPostFormData = new FormDataNode();
    dvachPostFormData.append('task', 'post'); 
    dvachPostFormData.append('board', board);
    
    const effectiveThreadIdForDvach = (!threadIdForDvach || threadIdForDvach === "0") ? "0" : threadIdForDvach;
    dvachPostFormData.append('thread', effectiveThreadIdForDvach);
    console.log(`${timestamp} [api/dvach-post] Dvach API 'thread' field set to: ${effectiveThreadIdForDvach}`);

    if (parentNumForDvach) {
      dvachPostFormData.append('parent', parentNumForDvach); 
      console.log(`${timestamp} [api/dvach-post] Dvach API 'parent' (reply to specific post) field set to: ${parentNumForDvach}`);
    }
    
    dvachPostFormData.append('comment', comment);
    dvachPostFormData.append('captcha_type', 'passcode'); 

    if (emailSage === 'sage') { 
      dvachPostFormData.append('email', 'sage'); 
      console.log(`${timestamp} [api/dvach-post] Sage requested.`);
    }
    
    const fileEntry = files.file; 
    const actualFile = Array.isArray(fileEntry) ? fileEntry[0] : fileEntry;

    if (actualFile && actualFile.filepath && actualFile.size > 0) {
      dvachPostFormData.append('file[]', fs.createReadStream(actualFile.filepath), { 
        filename: actualFile.originalFilename || 'upload.tmp', 
        contentType: actualFile.mimetype || 'application/octet-stream', 
      });
      console.log(`${timestamp} [api/dvach-post] Actual file attached to Dvach request: ${actualFile.originalFilename}`);
    }

    const dvachPostUrl = `${DVACH_BASE_URL}/user/posting?nc=1`;
    
    let cookieHeader = `passcode_auth=${passcodeAuthCookieValue}`;
    if (userCodeCookieValue) {
      cookieHeader += `; usercode=${userCodeCookieValue}`;
    }

    const dvachPostRequestHeaders = {
      ...dvachPostFormData.getHeaders(), 
      'Cookie': cookieHeader, 
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': clientUserAgent,
      'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
      'Referer': `${DVACH_BASE_URL}/${board}/`,
      'Origin': DVACH_BASE_URL,
      // Sec-Fetch-* headers removed for simplicity
    };
    
    console.log(`${timestamp} [api/dvach-post] Sending POST to Dvach: ${dvachPostUrl}. Headers: Cookie set, UA: ${clientUserAgent}`);

    let dvachPostResponse;
    try {
        dvachPostResponse = await fetch(dvachPostUrl, {
          method: 'POST',
          body: dvachPostFormData,
          headers: dvachPostRequestHeaders,
        });
    } catch (fetchPostError) {
        console.error(`${timestamp} [api/dvach-post] Network error calling Dvach /user/posting:`, fetchPostError);
        return res.status(502).json({ result:0, error: { code: -2003, message: `Failed to connect to Dvach for posting: ${fetchPostError.message}` }});
    }

    const dvachPostResponseText = await dvachPostResponse.text();
    console.log(`${timestamp} [api/dvach-post] Dvach /user/posting response status: ${dvachPostResponse.status}, body preview: ${dvachPostResponseText.substring(0,300)}`);

    res.setHeader('Content-Type', 'application/json'); 
    
    let dvachPostJson;
    try {
      dvachPostJson = JSON.parse(dvachPostResponseText);
    } catch (e) {
      console.warn(`${timestamp} [api/dvach-post] Dvach /user/posting response not valid JSON. Status: ${dvachPostResponse.status}. Text: ${dvachPostResponseText.substring(0,200)}`);
      if (!dvachPostResponse.ok) {
        return res.status(dvachPostResponse.status).json({ result: 0, error: { code: dvachPostResponse.status, message: dvachPostResponseText.substring(0,200) || `Unknown error from Dvach (non-JSON), status ${dvachPostResponse.status}` } });
      }
      // If response is OK but not JSON, it might be a redirect or an unexpected success page.
      // It's safer to assume success if status is OK and let the client figure out the post number if missing.
      return res.status(200).json({ result: 1, message: "Post attempt got OK status from Dvach, but response was not valid JSON. Check Dvach manually for post.", rawResponsePreview: dvachPostResponseText.substring(0,200), num: Date.now().toString() });
    }

    return res.status(dvachPostResponse.status).json(dvachPostJson);

  } catch (error) {
    console.error(`${timestamp} [api/dvach-post] Unhandled error in /api/dvach-post handler:`, error);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ result:0, error: { code: -2000, message: `Internal Server Error in /api/dvach-post: ${error.message}` }});
    }
  }
}