// api/dvach-post/index.js
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormDataNode from 'form-data';

export const config = {
  api: {
    bodyParser: false,
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
    
    console.log(`${timestamp} [api/dvach-post] Parsed client fields (excluding file data):`, JSON.stringify(Object.fromEntries(Object.entries(fields).map(([k,v]) => [k, Array.isArray(v) && v.length === 1 ? v[0] : v])), null, 2));

    const getFieldValue = (fieldName) => {
      const value = fields[fieldName];
      return Array.isArray(value) ? value[0] : value;
    };

    const board = getFieldValue('board');
    const clientThreadId = getFieldValue('thread_id_for_dvach'); // This comes from the client
    const clientParentNum = getFieldValue('parent_num_for_dvach'); // This comes from the client
    const comment = getFieldValue('comment');
    const passcodeAuthCookieValue = getFieldValue('passcode_auth_cookie_value');
    const userCodeCookieValue = getFieldValue('user_code_cookie_value'); // Optional
    const emailSage = getFieldValue('email'); // 'sage' or undefined
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
    
    console.log(`${timestamp} [api/dvach-post] Using provided session cookies to post to Dvach /user/posting...`);
    const dvachPostFormData = new FormDataNode();
    dvachPostFormData.append('board', board);
    
    // Determine the 'thread' value for Dvach API
    // If clientThreadId is "0" or empty, it's a new thread, so Dvach expects "0".
    // Otherwise, use the clientThreadId (which is the OP post number of the thread context).
    const dvachThreadValue = (!clientThreadId || clientThreadId === "0") ? "0" : clientThreadId;
    dvachPostFormData.append('thread', dvachThreadValue);
     console.log(`${timestamp} [api/dvach-post] Dvach 'thread' field set to: ${dvachThreadValue}`);

    // If clientParentNum is provided, it means this is a reply to a specific post within the thread.
    // Dvach's 'parent' field takes this specific post number for replies.
    // If it's a new thread post (dvachThreadValue is "0"), 'parent' is not usually sent or is "0".
    // If it's a post to an existing thread but not a direct reply to a specific comment (e.g. just a general post in thread), 'parent' would be the thread OP number (clientThreadId).
    // The current client logic in App.tsx sends `replyToPostNum` which becomes `parent_num_for_dvach` here.
    // If `parent_num_for_dvach` is present, it's a direct reply.
    if (clientParentNum) {
      dvachPostFormData.append('parent', clientParentNum);
      console.log(`${timestamp} [api/dvach-post] Dvach 'parent' field (reply to specific post) set to: ${clientParentNum}`);
    }
    
    dvachPostFormData.append('comment', comment);
    dvachPostFormData.append('captcha_type', 'passcode'); // Still 'passcode' as we are using a passcode-derived session

    if (emailSage) { 
      dvachPostFormData.append('email', emailSage); 
    }
    
    const fileEntryArray = files.file; // Assuming 'file' is the field name from client
    let actualFileAttached = false;
    if (fileEntryArray && fileEntryArray.length > 0) {
      const file = fileEntryArray[0];
      if (file && file.filepath && file.size > 0) {
        dvachPostFormData.append('file[]', fs.createReadStream(file.filepath), { 
          filename: file.originalFilename || 'upload.tmp', // Use original filename if available
          contentType: file.mimetype || 'application/octet-stream', // Use mimetype if available
        });
        actualFileAttached = true;
        console.log(`${timestamp} [api/dvach-post] Actual file attached to Dvach request: ${file.originalFilename}`);
      }
    }

    if (!actualFileAttached) {
      // If no file, Dvach might require a 'dummy' file field or just works without.
      // The Python script sends a dummy field if no file. Let's replicate.
      console.log(`${timestamp} [api/dvach-post] No actual file attached by client. Sending 'dummy' field to Dvach.`);
      dvachPostFormData.append('dummy', 'dummy content', { filename: '', contentType: 'text/plain' });
    }
    
    const dvachPostUrl = `${DVACH_BASE_URL}/user/posting`;
    
    let cookieHeader = `passcode_auth=${passcodeAuthCookieValue}`;
    if (userCodeCookieValue) {
      cookieHeader += `; usercode=${userCodeCookieValue}`;
    }

    const dvachPostRequestHeaders = {
      ...dvachPostFormData.getHeaders(), // Necessary for multipart/form-data boundary
      'Cookie': cookieHeader, 
      'Accept': 'application/json',
      'User-Agent': clientUserAgent, // Use User-Agent from client
    };

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
    console.log(`${timestamp} [api/dvach-post] Dvach /user/posting response status: ${dvachPostResponse.status}`);
    console.log(`${timestamp} [api/dvach-post] Dvach /user/posting response text (first 500 chars): ${dvachPostResponseText.substring(0, 500)}`);

    res.setHeader('Content-Type', 'application/json');
    
    let dvachPostJson;
    try {
      dvachPostJson = JSON.parse(dvachPostResponseText);
    } catch (e) {
      console.warn(`${timestamp} [api/dvach-post] Dvach /user/posting response not valid JSON. Status: ${dvachPostResponse.status}. Text: ${dvachPostResponseText.substring(0,200)}`);
      // If Dvach gives a non-JSON success (e.g., HTML page on some weird success/redirect), but status is OK
      if (!dvachPostResponse.ok) {
        return res.status(dvachPostResponse.status).json({ result: 0, error: { code: dvachPostResponse.status, message: dvachPostResponseText.substring(0,200) || `Unknown error from Dvach (non-JSON), status ${dvachPostResponse.status}` } });
      }
      // If status is OK but not JSON, it's ambiguous.
      return res.status(200).json({ result: 1, message: "Post attempt got OK status from Dvach, but response was not valid JSON. Check Dvach manually.", rawResponse: dvachPostResponseText.substring(0,200) });
    }

    // Forward Dvach's status and JSON response to the client
    return res.status(dvachPostResponse.status).json(dvachPostJson);

  } catch (error) {
    console.error(`${timestamp} [api/dvach-post] Unhandled error in /api/dvach-post handler:`, error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ result:0, error: { code: -2000, message: `Internal Server Error in /api/dvach-post: ${error.message}` }});
  }
}