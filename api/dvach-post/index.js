
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
    
    // console.log(`${timestamp} [api/dvach-post] Parsed client fields (excluding file data):`, JSON.stringify(Object.fromEntries(Object.entries(fields).map(([k,v]) => [k, Array.isArray(v) && v.length === 1 ? v[0] : v])), null, 2));

    const getFieldValue = (fieldName) => {
      const value = fields[fieldName];
      return Array.isArray(value) ? value[0] : value;
    };

    const board = getFieldValue('board');
    // This is the overall thread context (OP post number), or "0" if client intends to make a new thread.
    const clientContextThreadId = getFieldValue('thread_id_for_dvach'); 
    // This is the specific post number being replied to, if any.
    const clientReplyToParentNum = getFieldValue('parent_num_for_dvach'); 
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
    
    console.log(`${timestamp} [api/dvach-post] Using provided session cookies to post to Dvach /user/posting... UA: ${clientUserAgent}`);
    const dvachPostFormData = new FormDataNode();
    dvachPostFormData.append('board', board);
    
    // Dvach API field 'thread': OP post number of the thread, or "0" for a new thread.
    // clientContextThreadId comes from the client, representing this.
    const dvachApiThreadField = (!clientContextThreadId || clientContextThreadId === "0") ? "0" : clientContextThreadId;
    dvachPostFormData.append('thread', dvachApiThreadField);
    console.log(`${timestamp} [api/dvach-post] Dvach API 'thread' field set to: ${dvachApiThreadField}`);

    // Dvach API field 'parent': Specific post number being replied to.
    // clientReplyToParentNum comes from the client, representing this.
    // If clientReplyToParentNum is not provided, it's either a new thread or a general post in an existing thread (not a direct reply).
    // In these cases, 'parent' might not be needed or could be "0" or the thread OP num.
    // makaba.md suggests 'parent' holds the thread_id for non-OP posts.
    // For direct replies, this should be the specific post.
    if (clientReplyToParentNum) {
      dvachPostFormData.append('parent', clientReplyToParentNum);
      console.log(`${timestamp} [api/dvach-post] Dvach API 'parent' (reply to specific post) field set to: ${clientReplyToParentNum}`);
    } else if (dvachApiThreadField !== "0") {
      // If posting to an existing thread (dvachApiThreadField is OP num) but not a direct reply to a specific post,
      // Dvach might expect 'parent' to be the thread OP num.
      // Or it might not be needed if 'thread' is already set to OP num.
      // For safety, if it's not a new thread and not a direct reply, let's also set parent to the thread OP num.
      // This aligns with makaba.md's "parent: ID треда данного поста ... 0 для первого поста треда".
      // dvachPostFormData.append('parent', dvachApiThreadField);
      // console.log(`${timestamp} [api/dvach-post] Dvach API 'parent' (general post in thread) field set to: ${dvachApiThreadField}`);
      // Re-evaluating: if not a direct reply, `parent` field might not be strictly necessary if `thread` is already the OP.
      // Let's only set `parent` if `clientReplyToParentNum` is explicitly provided.
      // If it's a general post in a thread, `thread` field (set to OP) should be enough.
    }
    
    dvachPostFormData.append('comment', comment);
    dvachPostFormData.append('captcha_type', 'passcode'); 

    if (emailSage) { 
      dvachPostFormData.append('email', emailSage); 
    }
    
    const fileEntryArray = files.file; 
    let actualFileAttached = false;
    if (fileEntryArray && fileEntryArray.length > 0) {
      const file = fileEntryArray[0];
      if (file && file.filepath && file.size > 0) {
        dvachPostFormData.append('file[]', fs.createReadStream(file.filepath), { 
          filename: file.originalFilename || 'upload.tmp', 
          contentType: file.mimetype || 'application/octet-stream', 
        });
        actualFileAttached = true;
        console.log(`${timestamp} [api/dvach-post] Actual file attached to Dvach request: ${file.originalFilename}`);
      }
    }

    // Makaba seems to require a file field even if empty, or it can error.
    // If no actual file, some clients send an empty 'file[]' or a dummy.
    // For simplicity, if no file is attached, we won't add any 'file[]' or 'dummy' field.
    // Dvach should handle empty file submissions correctly if the board allows text-only posts,
    // or if it's a reply where files are optional.
    // If a board requires a file for OPs, and `dvachApiThreadField` is "0" and no file, Dvach will error (-19).

    const dvachPostUrl = `${DVACH_BASE_URL}/user/posting?nc=1`; // nc=1 is often used
    
    let cookieHeader = `passcode_auth=${passcodeAuthCookieValue}`;
    if (userCodeCookieValue) {
      cookieHeader += `; usercode=${userCodeCookieValue}`;
    }

    const dvachPostRequestHeaders = {
      ...dvachPostFormData.getHeaders(), 
      'Cookie': cookieHeader, 
      'Accept': 'application/json',
      'User-Agent': clientUserAgent,
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
    console.log(`${timestamp} [api/dvach-post] Dvach /user/posting response status: ${dvachPostResponse.status}`);
    // console.log(`${timestamp} [api/dvach-post] Dvach /user/posting response text (first 500 chars): ${dvachPostResponseText.substring(0, 500)}`);

    res.setHeader('Content-Type', 'application/json');
    
    let dvachPostJson;
    try {
      dvachPostJson = JSON.parse(dvachPostResponseText);
    } catch (e) {
      console.warn(`${timestamp} [api/dvach-post] Dvach /user/posting response not valid JSON. Status: ${dvachPostResponse.status}. Text: ${dvachPostResponseText.substring(0,200)}`);
      if (!dvachPostResponse.ok) {
        return res.status(dvachPostResponse.status).json({ result: 0, error: { code: dvachPostResponse.status, message: dvachPostResponseText.substring(0,200) || `Unknown error from Dvach (non-JSON), status ${dvachPostResponse.status}` } });
      }
      return res.status(200).json({ result: 1, message: "Post attempt got OK status from Dvach, but response was not valid JSON. Check Dvach manually.", rawResponsePreview: dvachPostResponseText.substring(0,200) });
    }

    return res.status(dvachPostResponse.status).json(dvachPostJson);

  } catch (error) {
    console.error(`${timestamp} [api/dvach-post] Unhandled error in /api/dvach-post handler:`, error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ result:0, error: { code: -2000, message: `Internal Server Error in /api/dvach-post: ${error.message}` }});
  }
}
