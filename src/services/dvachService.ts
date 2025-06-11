/// <reference types="vite/client" />
import { DvachThreadResponse, DvachPostApiResponse, DvachApiError, ProxyModeForGET, DvachSessionCookies, DvachPost } from '../types';
import { DEFAULT_CORS_ANYWHERE_PROXY, PROXY_URL_GO_X2U_BASE, THREAD_CACHE_DURATION_MS, DEFAULT_USER_AGENT } from '../constants';

interface CachedThread {
  data: DvachThreadResponse;
  timestamp: number;
}

function buildProxiedGetUrl(
  targetUrl: string,
  proxyMode: ProxyModeForGET,
  customProxyUrl?: string 
): string {
  switch (proxyMode) {
    case 'vercel_serverless':
      // This case should ideally not be hit if targetUrl is an external Dvach resource like an image.
      // For thread data, it means /api/get-thread. For images, a different strategy (or proxy) is needed if Vercel serverless is selected.
      console.warn(`[dvachService/buildProxiedGetUrl] Attempting to build proxied URL for '${targetUrl}' with 'vercel_serverless' mode. This mode is for /api/* endpoints. Falling back to direct URL or custom if applicable.`);
      // If a custom proxy URL is somehow set despite vercel_serverless mode, attempt to use it.
      if (customProxyUrl) {
        if (customProxyUrl.includes(PROXY_URL_GO_X2U_BASE.split('?')[0])) return `${customProxyUrl}${encodeURIComponent(targetUrl)}`;
        if (customProxyUrl.includes(DEFAULT_CORS_ANYWHERE_PROXY.split('/')[2])) return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
        // General prefix/param logic for custom URL if provided
        if (customProxyUrl.endsWith('=')) return `${customProxyUrl}${encodeURIComponent(targetUrl)}`; // Param style
        return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`; // Prefix style
      }
      return targetUrl; // Fallback to direct URL if no customProxyUrl makes sense here

    case 'custom_go_x2u':
      const goX2UBase = (customProxyUrl || PROXY_URL_GO_X2U_BASE);
      return `${goX2UBase}${encodeURIComponent(targetUrl)}`;

    case 'custom_cors_anywhere':
      const corsAnywhereBase = (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY).endsWith('/') 
          ? (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY) 
          : `${(customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY)}/`;
      return `${corsAnywhereBase}${targetUrl}`;

    case 'custom_general_prefix':
      if (!customProxyUrl) return targetUrl; 
      return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
      
    case 'custom_general_param':
      if (!customProxyUrl || !customProxyUrl.includes('=')) {
        console.warn(`[dvachService/buildProxiedGetUrl] Custom general param proxy mode selected, but URL '${customProxyUrl}' doesn't look like a param proxy. Using direct.`);
        return targetUrl;
      }
      return `${customProxyUrl}${encodeURIComponent(targetUrl)}`;

    case 'none':
    default:
      return targetUrl;
  }
}

export async function getThreadData(
  board: string, 
  threadId: string,
  proxyModeForGET: ProxyModeForGET, 
  customProxyUrlForGET?: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<DvachThreadResponse> {
  if (!board || !threadId) {
    throw new Error("Board and Thread ID are required for getThreadData.");
  }

  const cacheKey = `dvach_thread_${board}_${threadId}`;
  const cachedItem = localStorage.getItem(cacheKey);

  if (cachedItem) {
    try {
      const parsedCache: CachedThread = JSON.parse(cachedItem);
      if (Date.now() - parsedCache.timestamp < THREAD_CACHE_DURATION_MS) {
        console.info(`[dvachService/getThreadData] Cache hit for ${board}/${threadId}`);
        return parsedCache.data;
      }
      localStorage.removeItem(cacheKey);
      console.info(`[dvachService/getThreadData] Cache stale for ${board}/${threadId}`);
    } catch (error) {
      console.warn("[dvachService/getThreadData] Failed to parse cached thread data, removing.", error);
      localStorage.removeItem(cacheKey);
    }
  }

  let fetchUrl: string;
  let targetDvachUrl: string | undefined; // For logging/debugging

  if (proxyModeForGET === 'vercel_serverless') {
    fetchUrl = `/api/get-thread?board=${encodeURIComponent(board)}&thread=${encodeURIComponent(threadId)}`;
    console.info(`[dvachService/getThreadData] Fetching thread via Vercel Serverless: ${fetchUrl}`);
  } else {
    // Assuming 2ch.hk as the base, could be made dynamic from DVACH_DOMAINS in future if needed for this service
    targetDvachUrl = `https://2ch.hk/${board}/res/${threadId}.json`; 
    fetchUrl = buildProxiedGetUrl(targetDvachUrl, proxyModeForGET, customProxyUrlForGET);
    console.info(`[dvachService/getThreadData] Fetching thread. Mode: ${proxyModeForGET}. URL: ${fetchUrl} (target Dvach API: ${targetDvachUrl})`);
  }
  
  let response;
  try {
    response = await fetch(fetchUrl, {
      headers: {
        // User-Agent for serverless is set by the function itself.
        // For direct/proxied, use the passed or default UA.
        ...(proxyModeForGET !== 'vercel_serverless' && { 'User-Agent': userAgent }),
        'Accept': 'application/json',
      }
    });
  } catch (networkError) {
    console.error(`[dvachService/getThreadData] Network error fetching ${fetchUrl}:`, networkError);
    throw new Error(`Network error while fetching thread: ${(networkError as Error).message}. URL: ${fetchUrl}, Target API: ${targetDvachUrl || 'N/A (Serverless)'}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Could not retrieve error text.");
    console.error(`[dvachService/getThreadData] Failed to fetch thread ${board}/${threadId} from ${fetchUrl}. Status: ${response.status}. Response: ${errorText.substring(0,500)}`);
    throw new Error(`Failed to fetch thread: ${response.status} ${response.statusText}. URL: ${fetchUrl}, Target API: ${targetDvachUrl || 'N/A (Serverless)'}. Server/Proxy response: ${errorText.substring(0,200)}`);
  }

  let data: DvachThreadResponse;
  try {
    const rawData = await response.json();
    // Ensure post numbers are strings, as per Dvach API sometimes returning numbers
    if (rawData.threads && rawData.threads[0] && rawData.threads[0].posts) {
        rawData.threads[0].posts = rawData.threads[0].posts.map((post: any): DvachPost => ({
            ...post,
            num: String(post.num), // Ensure string
            parent: String(post.parent), // Ensure string
        }));
    }
    data = rawData as DvachThreadResponse;

  } catch (jsonError) {
    const responseTextFallback = "Could not get text after JSON parse failed.";
    const responseTextIfAvailable = response.bodyUsed ? responseTextFallback : await response.text().catch(() => responseTextFallback);
    console.error(`[dvachService/getThreadData] Failed to parse JSON response from ${fetchUrl}. Error:`, jsonError, "Response text:", responseTextIfAvailable.substring(0, 500));
    throw new Error(`Invalid JSON response from ${fetchUrl}. Check proxy or API. Target: ${targetDvachUrl || 'N/A (Serverless)'}. Details: ${responseTextIfAvailable.substring(0,200)}`);
  }
  
  const cacheEntry: CachedThread = { data, timestamp: Date.now() };
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn("[dvachService/getThreadData] Failed to save thread data to localStorage", error);
  }

  return data;
}

/**
 * Logs into Dvach using the purchased passcode via the /api/dvach-login serverless function.
 * @param purchasedPasscode The user's purchased passcode string.
 * @param userAgent The User-Agent string for the request.
 * @returns Promise resolving to an object containing session cookie values.
 */
export async function loginToDvach(
  purchasedPasscode: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<DvachSessionCookies> {
  console.info('[dvachService/loginToDvach] Attempting Dvach login via /api/dvach-login...');
  
  let response;
  try {
    response = await fetch('/api/dvach-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Serverless function expects JSON
        'X-User-Agent': userAgent, // Pass user agent to serverless function
      },
      body: JSON.stringify({ purchased_passcode: purchasedPasscode }),
    });
  } catch (networkError) {
    console.error('[dvachService/loginToDvach] Network error calling /api/dvach-login:', networkError);
    throw new Error(`Network error calling login API /api/dvach-login: ${(networkError as Error).message}`);
  }

  const responseData: DvachPostApiResponse = await response.json().catch(async (e) => {
      const text = await response.text();
      console.error('[dvachService/loginToDvach] Failed to parse JSON from /api/dvach-login. Status:', response.status, 'Body:', text.substring(0,500), e);
      throw new Error(`Login API /api/dvach-login returned non-JSON response (Status: ${response.status}). Body: ${text.substring(0,200)}`);
  });

  if (!response.ok || responseData.result !== 1 || !responseData.passcode_auth_cookie_value) {
    const errorMsg = responseData?.error?.message || responseData?.reason || responseData?.Error || `Dvach login failed (via /api/dvach-login). Status: ${response.status}.`;
    console.error('[dvachService/loginToDvach] Login failed:', errorMsg, responseData);
    throw new Error(errorMsg);
  }

  console.info('[dvachService/loginToDvach] Login successful. Session cookies obtained.');
  return {
    passcode_auth: responseData.passcode_auth_cookie_value,
    usercode: responseData.user_code_cookie_value || null, // user_code might be optional
  };
}


/**
 * Sends data to the internal serverless function /api/dvach-post using active session cookies.
 * @param sessionCookies The active Dvach session cookies (passcode_auth, usercode).
 * @param board Board ID (e.g., "b").
 * @param threadIdForDvach Thread ID to post in, or "0"/empty for new thread. This is Dvach's 'thread' field.
 * @param comment Post content.
 * @param file Optional file to attach.
 * @param parentPostNumForDvach Optional. Specific post number being replied to. This is Dvach's 'parent' field.
 * @param useSage Whether to use sage.
 * @param userAgent The User-Agent string for the request (passed to serverless).
 * @returns Promise resolving to Dvach's API response forwarded by the serverless function.
 */
export async function postWithSessionCookie(
    sessionCookies: DvachSessionCookies,
    board: string,
    threadIdForDvach: string, // Corresponds to Dvach API 'thread' field (0 for new thread, OP num for existing)
    comment: string,
    file?: File | null,
    parentPostNumForDvach?: string, // Corresponds to Dvach API 'parent' field (specific post num being replied to)
    useSage?: boolean,
    userAgent: string = DEFAULT_USER_AGENT
  ): Promise<DvachPostApiResponse> {
  
  if (!sessionCookies.passcode_auth) {
    throw new Error("passcode_auth session cookie is missing. Cannot post. Please login.");
  }

  console.info('[dvachService/postWithSessionCookie] Preparing data for /api/dvach-post. Params:', { board, threadIdForDvach, commentLength: comment.length, hasFile: !!file, parentPostNumForDvach, useSage });
  
  const formData = new FormData();
  formData.append('passcode_auth_cookie_value', sessionCookies.passcode_auth);
  if (sessionCookies.usercode) {
    formData.append('user_code_cookie_value', sessionCookies.usercode);
  }
  formData.append('board', board);
  formData.append('thread_id_for_dvach', threadIdForDvach); // This is Dvach's 'thread' field in API /user/posting
  formData.append('comment', comment);

  if (parentPostNumForDvach) {
    formData.append('parent_num_for_dvach', parentPostNumForDvach); // This is Dvach's 'parent' field in API /user/posting
  }
  if (useSage) {
    formData.append('email', 'sage'); // Dvach uses 'email' field for sage
  }
  if (file) {
    formData.append('file', file, file.name);
  }

  let response;
  try {
    response = await fetch('/api/dvach-post', {
      method: 'POST',
      headers: {
        'X-User-Agent': userAgent, // Pass user agent to serverless function
      },
      body: formData, 
    });
  } catch (networkError) {
     console.error(`[dvachService/postWithSessionCookie] Network error calling /api/dvach-post:`, networkError);
     throw new Error(`Network error calling serverless post function /api/dvach-post: ${(networkError as Error).message}`);
  }

  let responseBodyText = "Could not read response body from /api/dvach-post.";
  let responseData: DvachPostApiResponse;

  try {
    responseBodyText = await response.text();
    if (!responseBodyText) {
        const errorDetail = `Status: ${response.status} ${response.statusText}. Response body was empty from /api/dvach-post.`;
        if (!response.ok) throw new Error(`Serverless function /api/dvach-post error: ${errorDetail}`);
        // This case might indicate an issue with the serverless function itself if it returns 200 OK with empty body.
        throw new Error(`Serverless function /api/dvach-post returned OK but with an empty response body. Check serverless logs for /api/dvach-post.`);
    }
    responseData = JSON.parse(responseBodyText);
  } catch (e) {
    console.error(`[dvachService/postWithSessionCookie] Error processing /api/dvach-post response. Status: ${response.status}. Text: "${responseBodyText.substring(0,500)}". Parse/Error:`, e);
    const baseErrorMsg = `Serverless function /api/dvach-post error. Status: ${response.status} ${response.statusText}. Raw response from /api/dvach-post: ${responseBodyText.substring(0,200)}.`;
    if (response.ok && e instanceof SyntaxError) { // If serverless returns 200 OK but body is not JSON
        throw new Error(`${baseErrorMsg} Response was not valid JSON. Error: ${(e as Error).message}`);
    } else { // Any other error during parsing or if response was not OK
        throw new Error(`${baseErrorMsg} Error: ${(e as Error).message}`);
    }
  }
  
  // Check the structured response from /api/dvach-post (which should reflect Dvach's actual response or serverless errors)
  if (!response.ok) { // Serverless function itself returned an error status
    const errorMsg = responseData?.error?.message || responseData?.reason || responseData?.Error || `Posting failed (via /api/dvach-post). Serverless Status ${response.status}.`;
    console.error(`[dvachService/postWithSessionCookie] Failed to create post via /api/dvach-post. Serverless Status: ${response.status}. Dvach/Serverless Message: ${errorMsg}`, responseData);
    throw new Error(errorMsg); 
  }
  
  // If serverless status is OK, check Dvach's result within the JSON
  if (responseData && (responseData.result === 0 || responseData.Error || responseData.reason || responseData.error)) {
    const dvachErrorMsg = responseData.reason || responseData.Error || responseData.error?.message || "Unknown Dvach API error (forwarded by /api/dvach-post)";
    console.error('[dvachService/postWithSessionCookie] Dvach API indicated an error (via /api/dvach-post):', dvachErrorMsg, responseData);
    throw new Error(dvachErrorMsg);
  }

  // If serverless is OK, and Dvach result indicates success (1) or other (like 2 for passcode active)
  // but expected fields like 'num' or 'thread' are missing.
  if (!responseData || ((responseData.result !== 1 && responseData.result !== 2) && !responseData.num && !responseData.target && !responseData.thread)) {
     console.error('[dvachService/postWithSessionCookie] Post success reported by /api/dvach-post, but Dvach response format unexpected or missing post/thread number.', responseData);
     throw new Error('Post attempt seemed successful (via /api/dvach-post) but Dvach response format was unexpected or lacked a post/thread number.');
  }

  // Ensure returned post/thread numbers are strings
  if (responseData.num) responseData.num = String(responseData.num);
  if (responseData.thread) responseData.thread = String(responseData.thread);
  if (responseData.target) responseData.target = String(responseData.target);

  console.info('[dvachService/postWithSessionCookie] Post creation via /api/dvach-post successful:', responseData);
  return responseData;
}


export function extractDvachApiError(error: any): DvachApiError | null {
  if (error && typeof error.message === 'string') {
    // Attempt to parse if error.message is a JSON string (from serverless function)
    try {
      const parsedOuterError = JSON.parse(error.message);
      // Check if parsedOuterError contains Dvach's error structure
      if (parsedOuterError && parsedOuterError.error && typeof parsedOuterError.error.code === 'number' && typeof parsedOuterError.error.message === 'string') {
        return { code: parsedOuterError.error.code, message: parsedOuterError.error.message } as DvachApiError;
      }
      if(parsedOuterError && parsedOuterError.result === 0 && (parsedOuterError.reason || parsedOuterError.Error)) {
        return { code: -1, message: parsedOuterError.reason || parsedOuterError.Error };
      }
    } catch (e) { /* Not a JSON string encapsulating another error */ }

    // If error object itself has code and message (direct DvachApiError like object)
    if(typeof error.code === 'number' && typeof error.message === 'string'){
        return { code: error.code, message: error.message };
    }
    
    // Regex for specific Dvach error patterns in a plain string message
    const match = error.message.match(/Error code (-?\d+)|Dvach API Error \((-?\d+)\)/i);
    if (match) {
      const code = parseInt(match[1] || match[2], 10);
      return { code: code, message: error.message };
    }
    // If error object directly has Dvach's "result: 0" structure
     if (error.result === 0 && (error.reason || error.Error)) {
        return { code: -1, message: error.reason || error.Error }; // Use -1 as a generic Dvach error code if specific one isn't available
    }
  }
  // If error is an object with Dvach's direct error structure (not in message string)
  if (error && error.error && typeof error.error.code === 'number' && typeof error.error.message === 'string') {
     return { code: error.error.code, message: error.error.message } as DvachApiError;
  }
  if (error && error.result === 0 && (error.reason || error.Error)) {
     return { code: -1, message: error.reason || error.Error };
  }

  return null;
}

/**
 * Converts a base64 string to a File object.
 * @param base64 The base64 encoded string.
 * @param filename The desired filename for the File object.
 * @param mimeType The MIME type of the file.
 * @returns Promise resolving to a File object.
 */
export async function base64ToFile(base64: string, filename: string, mimeType: string): Promise<File> {
  const res = await fetch(`data:${mimeType};base64,${base64}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: mimeType });
}
