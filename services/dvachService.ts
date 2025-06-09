
import { DvachThread } from '../types';

const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes, kept local to this service for its cache logic

/**
 * Calculates SHA256 hash of a file.
 * @param file The file to hash.
 * @returns Promise resolving to the hex string of the hash.
 */
export async function sha256File(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Obtains an authentication token (typically by setting a cookie) from the Dvach server.
 * GET/POST запросы к passlogin все еще могут использовать прокси.
 * @param domain The Dvach domain (e.g., "https://2ch.hk").
 * @param passcode The user's passcode.
 * @param userAgent The User-Agent string for the request.
 * @param proxyPrefix Optional proxy URL prefix.
 * @returns Promise resolving to a dummy token or success indicator.
 */
export async function obtainAuthToken(
  domain: string,
  passcode: string,
  userAgent: string,
  proxyPrefix: string = ''
): Promise<string> {
  const targetUrl = `${domain}/user/passlogin/`;
  // Corrected: cors-anywhere expects the target URL to be directly appended, not encoded.
  const finalUrl = proxyPrefix ? `${proxyPrefix}${targetUrl}` : targetUrl; 
  
  const requestBodyFormData = new FormData(); 
  requestBodyFormData.append('passcode', passcode);
  requestBodyFormData.append('json', '1');


  console.log(`[DvachService/obtainAuthToken] Attempting passlogin: ${finalUrl} (actual target: ${targetUrl})`);

  const response = await fetch(finalUrl, {
    method: 'POST', 
    headers: {
      'User-Agent': userAgent,
      'Accept': 'application/json',
    },
    body: requestBodyFormData, 
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error(`[DvachService/obtainAuthToken] Failed. Status: ${response.status}. Resp: ${responseText}`);
    throw new Error(`Failed to obtain auth token: ${response.status} ${response.statusText}. Server: ${responseText.substring(0,150)}`);
  }
  
  try {
    const data = JSON.parse(responseText);
    // Success conditions might vary slightly by domain mirror or API changes
    if (data.result === 1 || data.status === "success" || data.message === "OK" || response.headers.get("Set-Cookie") || data.result === 0) { 
        console.log(`[DvachService/obtainAuthToken] Auth token request likely successful for ${domain}. Check browser cookies. Data:`, data);
        return "auth_token_acquired_placeholder";
    } else {
        console.warn(`[DvachService/obtainAuthToken] Auth successful but response indicates potential issue:`, data);
        throw new Error(`Auth token acquisition unclear: ${JSON.stringify(data)}`);
    }
  } catch (e) {
     console.error(`[DvachService/obtainAuthToken] Auth token response not JSON or parse error: ${responseText}`, e);
     if(response.headers.get("Set-Cookie") || response.status === 200) {
        console.warn(`[DvachService/obtainAuthToken] Assuming cookie set despite non-JSON/problematic JSON response.`);
        return "auth_token_acquired_placeholder_non_json";
     }
     throw new Error(`Failed to parse auth token response: ${(e as Error).message}`);
  }
}

/**
 * Posts a message to a Dvach thread using the internal serverless function /api/post.
 * @param _domain The Dvach domain (not used for fetch URL, but kept for signature consistency).
 * @param authToken Auth token (passcode_auth).
 * @param board Board ID.
 * @param threadId Thread ID (contextual, from settings).
 * @param comment Post content.
 * @param _userAgent User-Agent string (not used for fetch, serverless function sets its own).
 * @param file Optional file to attach.
 * @param parent Parent post ID (for replies, specific post num) or undefined.
 * @param useSage Whether to use sage.
 * @returns Promise resolving to an object containing the new post number.
 */
export async function dvachPost(
  _domain: string, 
  authToken: string, 
  board: string,
  threadId: string, 
  comment: string,
  _userAgent: string, 
  file: File | null,
  parent: string | undefined, 
  useSage: boolean
): Promise<{ num: string | number; [key: string]: any }> {
  
  const internalApiUrl = '/api/post'; 

  const formData = new FormData();
  formData.append('board', board);
  formData.append('thread_id_context', threadId); 
  if (parent) {
    formData.append('parent_num_reply', parent); 
  }
  formData.append('comment', comment);
  formData.append('passcode_auth', authToken);

  if (useSage) {
    formData.append('email', 'sage');
  }
  if (file) {
    formData.append('file', file, file.name);
  }

  console.log(`[DvachService/dvachPost] Posting via serverless function: ${internalApiUrl}`);
  
  const response = await fetch(internalApiUrl, {
    method: 'POST',
    body: formData, 
  });

  const responseText = await response.text();
  let responseData;
  try {
      responseData = JSON.parse(responseText);
  } catch (e) {
      console.error(`[DvachService/dvachPost] Failed to parse JSON from /api/post: ${responseText}`, e);
       if (!response.ok) {
           throw new Error(`Serverless function error: ${response.status} ${response.statusText}. Response: ${responseText.substring(0, 200)}`);
       }
       throw new Error(`Serverless function non-JSON response: ${responseText.substring(0,200)}`);
  }


  if (!response.ok) {
    console.error(`[DvachService/dvachPost] Serverless function error. Status: ${response.status}. Resp:`, responseData);
    throw new Error(`Serverless function /api/post failed: ${response.status} ${response.statusText}. Details: ${responseData?.message || responseData?.error || 'Unknown serverless error'}`);
  }
  
  if (responseData.Error || responseData.error || responseData.reason) {
      const errorMsg = responseData.Error || responseData.error || responseData.reason;
      console.error(`[DvachService/dvachPost] Dvach API Error (via serverless): ${errorMsg}`);
      throw new Error(`Dvach post API error (via serverless): ${errorMsg}`);
  }

  const postNum = responseData.num || responseData.target || responseData.thread; 
  if (!postNum) {
      console.error(`[DvachService/dvachPost] No post number in response from /api/post:`, responseData);
      throw new Error('Post successful (via serverless) but no post number in response.');
  }

  console.log(`[DvachService/dvachPost] Success (via serverless). Num: ${postNum}`, responseData);
  return { num: postNum.toString(), ...responseData };
}

/**
 * Fetches data for a specific Dvach thread.
 * GET запросы (как этот) все еще могут использовать прокси.
 * @param domain The Dvach domain.
 * @param board Board ID.
 * @param threadId Thread ID.
 * @param userAgent User-Agent string.
 * @param proxyPrefix Optional proxy URL prefix.
 * @returns Promise resolving to the thread data.
 */
export async function getDvachThread(
  domain: string,
  board: string,
  threadId: string | number,
  userAgent: string,
  proxyPrefix: string = ''
): Promise<DvachThread> {
  if (!board || !threadId) {
    throw new Error("Board and Thread ID must be specified.");
  }
  if (!domain) {
    throw new Error("Domain must be specified.");
  }

  const cacheKey = `dvach_thread_cache_${domain}_${board}_${threadId}`;
  try {
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      const { data, timestamp } = JSON.parse(cachedItem);
      if (Date.now() - timestamp < CACHE_DURATION_MS) {
        console.log(`[DvachService/getDvachThread] Cache hit for ${domain}/${board}/${threadId}`);
        return data as DvachThread;
      } else {
        console.log(`[DvachService/getDvachThread] Cache stale for ${domain}/${board}/${threadId}`);
        localStorage.removeItem(cacheKey);
      }
    }
  } catch (e) {
    console.warn(`[DvachService/getDvachThread] Cache read error for ${domain}/${board}/${threadId}:`, e);
  }

  const targetUrl = `${domain}/${board}/res/${threadId}.json`;
  // Corrected: cors-anywhere expects the target URL to be directly appended, not encoded.
  const finalUrl = proxyPrefix ? `${proxyPrefix}${targetUrl}` : targetUrl;


  console.log(`[DvachService/getDvachThread] Fetching: ${finalUrl} (actual target: ${targetUrl})`);

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      const serverErrorText = await response.text().catch(() => "Could not get error text.");
      const errorMsg = `HTTP Error ${response.status} ${response.statusText} for ${finalUrl}. Server: ${serverErrorText.substring(0, 500)}`;
      console.error(`[DvachService/getDvachThread] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const data: DvachThread = await response.json();

    try {
      const cacheEntry = { data, timestamp: Date.now() };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      console.log(`[DvachService/getDvachThread] Cached ${domain}/${board}/${threadId}.`);
    } catch (e) {
      console.warn(`[DvachService/getDvachThread] Cache save error for ${domain}/${board}/${threadId}:`, e);
    }
    return data;

  } catch (error) {
    console.error(`[DvachService/getDvachThread] Critical fetch error for ${finalUrl}:`, error);
    if (error instanceof Error && error.message.startsWith('HTTP Error')) {
        throw error;
    }
    const originalErrorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Network error or proxy issue for ${targetUrl} (via proxy: ${proxyPrefix || 'none'}). Original: ${originalErrorMessage}`);
  }
}
