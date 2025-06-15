
import { DvachThreadResponse, DvachPostApiResponse, DvachApiError, ProxyModeForGET, DvachSessionCookies, DvachPost } from '../types';
import { DEFAULT_CORS_ANYWHERE_PROXY, PROXY_URL_GO_X2U_BASE, THREAD_CACHE_DURATION_MS, DEFAULT_USER_AGENT, PROXY_URL_CODETABS_BASE } from '../constants'; // Removed DVACH_DOMAINS

interface CachedThread {
  data: DvachThreadResponse;
  timestamp: number;
}

// Consolidate proxy URL building logic here, usable by App.tsx as well if needed.
// This version is more aligned with what was in App.tsx previously for diverse proxy types.
export function buildProxiedGetUrl(
  targetUrl: string,
  proxyMode: ProxyModeForGET,
  customProxyUrl?: string 
): string {
  if (!targetUrl.startsWith('http')) { 
    // Allow relative paths for internal API calls, e.g. /api/get-thread
    if (!targetUrl.startsWith('/api/')) { 
        console.warn(`[dvachService/buildProxiedGetUrl] targetUrl '${targetUrl}' is not a full HTTP/S URL nor an /api/ path. Returning as is.`);
    }
    return targetUrl; 
  }
  
  switch (proxyMode) {
    case 'custom_go_x2u':
      return `${customProxyUrl || PROXY_URL_GO_X2U_BASE}${encodeURIComponent(targetUrl)}`;
    case 'custom_cors_anywhere':
      const corsBase = (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY).endsWith('/') 
          ? (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY) 
          : `${(customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY)}/`;
      return `${corsBase}${targetUrl}`;
    case 'custom_codetabs': // Primarily for images
      // CodeTabs expects the URL without http(s):// prefix for its quest param
      return `${customProxyUrl || PROXY_URL_CODETABS_BASE}${encodeURIComponent(targetUrl.replace(/^https?:\/\//, ''))}`;
    case 'custom_general_prefix':
      if (!customProxyUrl) return targetUrl;
      return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
      
    case 'custom_general_param':
      if (!customProxyUrl || !customProxyUrl.includes('=')) {
        console.warn(`[dvachService/buildProxiedGetUrl] Custom general param proxy mode, but URL '${customProxyUrl}' is invalid. Using direct.`);
        return targetUrl;
      }
      return `${customProxyUrl}${encodeURIComponent(targetUrl)}`;
    case 'vercel_serverless': 
         console.warn(`[dvachService/buildProxiedGetUrl] 'vercel_serverless' proxy mode used for client-side construction with external URL '${targetUrl}'. This is typically handled by direct /api/* calls. Verify configuration if this was unintended. Using direct fetch for this URL if it's external.`);
         return targetUrl; // This function is for client-side URL construction. If it's an external URL, this mode shouldn't apply here.
    case 'none':
    default:
      return targetUrl;
  }
}

export async function getThreadData(
  baseDvachDomain: string, // New parameter
  board: string, 
  threadId: string,
  proxyModeForGET: ProxyModeForGET, 
  customProxyUrlForGET?: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<DvachThreadResponse> {
  if (!baseDvachDomain) {
    throw new Error("Base Dvach Domain is required for getThreadData.");
  }
  if (!board || !threadId) {
    throw new Error("Board and Thread ID are required for getThreadData.");
  }

  const cacheKey = `dvach_thread_${baseDvachDomain}_${board}_${threadId}`;
  const cachedItem = localStorage.getItem(cacheKey);

  if (cachedItem) {
    try {
      const parsedCache: CachedThread = JSON.parse(cachedItem);
      if (Date.now() - parsedCache.timestamp < THREAD_CACHE_DURATION_MS) {
        console.info(`[dvachService/getThreadData] Cache hit for ${baseDvachDomain}/${board}/${threadId}`);
        return parsedCache.data;
      }
      localStorage.removeItem(cacheKey);
      console.info(`[dvachService/getThreadData] Cache stale for ${baseDvachDomain}/${board}/${threadId}`);
    } catch (error) {
      console.warn("[dvachService/getThreadData] Failed to parse cached thread data, removing.", error);
      localStorage.removeItem(cacheKey);
    }
  }

  let fetchUrl: string;
  let targetDvachUrl: string | undefined; 

  if (proxyModeForGET === 'vercel_serverless') {
    // Note: /api/get-thread internally targets 2ch.hk, this client-setting doesn't change that serverless function's target.
    fetchUrl = `/api/get-thread?board=${encodeURIComponent(board)}&thread=${encodeURIComponent(threadId)}`;
    console.info(`[dvachService/getThreadData] Fetching thread via Vercel Serverless: ${fetchUrl} (Serverless function targets 2ch.hk)`);
  } else {
    targetDvachUrl = `${baseDvachDomain}/${board}/res/${threadId}.json`; 
    fetchUrl = buildProxiedGetUrl(targetDvachUrl, proxyModeForGET, customProxyUrlForGET);
    console.info(`[dvachService/getThreadData] Fetching thread. Mode: ${proxyModeForGET}. URL: ${fetchUrl} (target Dvach API: ${targetDvachUrl})`);
  }
  
  let response;
  try {
    response = await fetch(fetchUrl, {
      headers: {
        ...(proxyModeForGET !== 'vercel_serverless' && { 'User-Agent': userAgent }), // User-Agent not needed for our own /api endpoint
        'Accept': 'application/json',
      }
    });
  } catch (networkError) {
    console.error(`[dvachService/getThreadData] Network error fetching ${fetchUrl}:`, networkError);
    throw new Error(`Network error while fetching thread: ${(networkError as Error).message}. URL: ${fetchUrl}, Target API: ${targetDvachUrl || 'N/A (Serverless always targets 2ch.hk)'}`);
  }

  const responseBodyText = await response.text();
  if (!response.ok) {
    console.error(`[dvachService/getThreadData] Failed to fetch thread ${board}/${threadId} from ${fetchUrl}. Status: ${response.status}. Response: ${responseBodyText.substring(0,500)}`);
    throw new Error(`Failed to fetch thread: ${response.status} ${response.statusText}. URL: ${fetchUrl}, Target API: ${targetDvachUrl || 'N/A (Serverless always targets 2ch.hk)'}. Server/Proxy response: ${responseBodyText.substring(0,200)}`);
  }

  let data: DvachThreadResponse;
  try {
    const rawData = JSON.parse(responseBodyText);
    if (rawData.threads && rawData.threads[0] && rawData.threads[0].posts) {
        rawData.threads[0].posts = rawData.threads[0].posts.map((post: any): DvachPost => ({
            ...post,
            num: String(post.num), 
            parent: String(post.parent), 
        }));
    }
    data = rawData as DvachThreadResponse;

  } catch (jsonError) {
    console.error(`[dvachService/getThreadData] Failed to parse JSON response from ${fetchUrl}. Error:`, jsonError, "Response text:", responseBodyText.substring(0, 500));
    throw new Error(`Invalid JSON response from ${fetchUrl}. Check proxy or API. Target: ${targetDvachUrl || 'N/A (Serverless always targets 2ch.hk)'}. Details: ${responseBodyText.substring(0,200)}`);
  }
  
  const cacheEntry: CachedThread = { data, timestamp: Date.now() };
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn("[dvachService/getThreadData] Failed to save thread data to localStorage", error);
  }

  return data;
}


export async function loginToDvach(
  purchasedPasscode: string,
  userAgent: string = DEFAULT_USER_AGENT
): Promise<DvachSessionCookies> {
  // This function uses /api/dvach-login, which internally targets 2ch.hk
  console.info('[dvachService/loginToDvach] Attempting Dvach login via /api/dvach-login (targets 2ch.hk)...');
  
  let response;
  try {
    response = await fetch('/api/dvach-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 
        'X-User-Agent': userAgent, 
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

  if (!response.ok || (responseData.result !== 1 && responseData.result !== 2) || !responseData.passcode_auth_cookie_value) {
    const errorMsg = responseData?.error?.message || responseData?.reason || responseData?.Error || `Dvach login failed (via /api/dvach-login). Status: ${response.status}.`;
    console.error('[dvachService/loginToDvach] Login failed:', errorMsg, responseData);
    throw new Error(errorMsg);
  }

  console.info('[dvachService/loginToDvach] Login successful. Session cookies received.');
  return {
    passcode_auth: responseData.passcode_auth_cookie_value,
    usercode: responseData.user_code_cookie_value || null, 
  };
}


export async function postWithSessionCookie(
    sessionCookies: DvachSessionCookies,
    board: string,
    threadIdForDvach: string, 
    comment: string,
    file?: File | null,
    parentPostNumForDvach?: string, 
    useSage?: boolean,
    userAgent: string = DEFAULT_USER_AGENT
  ): Promise<DvachPostApiResponse> {
  
  if (!sessionCookies.passcode_auth) {
    throw new Error("passcode_auth session cookie is missing. Cannot post. Please login.");
  }
  // This function uses /api/dvach-post, which internally targets 2ch.hk
  console.info('[dvachService/postWithSessionCookie] Preparing data for /api/dvach-post (targets 2ch.hk). Params:', { board, threadIdForDvach, commentLength: comment.length, hasFile: !!file, parentPostNumForDvach, useSage });
  
  const formData = new FormData();
  formData.append('passcode_auth_cookie_value', sessionCookies.passcode_auth);
  if (sessionCookies.usercode) {
    formData.append('user_code_cookie_value', sessionCookies.usercode);
  }
  formData.append('board', board);
  formData.append('thread_id_for_dvach', threadIdForDvach); 
  formData.append('comment', comment);

  if (parentPostNumForDvach) {
    formData.append('parent_num_for_dvach', parentPostNumForDvach); 
  }
  if (useSage) {
    formData.append('email', 'sage'); 
  }
  if (file) {
    formData.append('file', file, file.name);
  }

  let response;
  try {
    response = await fetch('/api/dvach-post', {
      method: 'POST',
      headers: {
        'X-User-Agent': userAgent, 
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
    if (!responseBodyText && !response.ok) { // Allow empty body on OK for some reason, though not expected
        const errorDetail = `Status: ${response.status} ${response.statusText}. Response body was empty from /api/dvach-post.`;
        throw new Error(`Serverless function /api/dvach-post error: ${errorDetail}`);
    } else if (!responseBodyText && response.ok) {
        // This case indicates an issue with the serverless function itself if it returns 200 OK with empty body.
        console.warn(`[dvachService/postWithSessionCookie] Serverless function /api/dvach-post returned OK but with an empty response body. Assuming potential success if no other error.`)
        return { result: 1, message: "Serverless post function returned OK with empty body. Check Dvach manually for post.", num: Date.now().toString() };
    }
    responseData = JSON.parse(responseBodyText);
  } catch (e) {
    console.error(`[dvachService/postWithSessionCookie] Error processing /api/dvach-post response. Status: ${response.status}. Text: "${responseBodyText.substring(0,500)}". Parse/Error:`, e);
    const baseErrorMsg = `Serverless function /api/dvach-post error. Status: ${response.status} ${response.statusText}. Raw response from /api/dvach-post: ${responseBodyText.substring(0,200)}.`;
    if (response.ok && e instanceof SyntaxError) { 
        throw new Error(`${baseErrorMsg} Response was not valid JSON. Error: ${(e as Error).message}`);
    } else { 
        throw new Error(`${baseErrorMsg} Error: ${(e as Error).message}`);
    }
  }
  
  if (!response.ok) { 
    const errorMsg = responseData?.error?.message || responseData?.reason || responseData?.Error || `Posting failed (via /api/dvach-post). Serverless Status ${response.status}.`;
    console.error(`[dvachService/postWithSessionCookie] Failed to create post via /api/dvach-post. Serverless Status: ${response.status}. Dvach/Serverless Message: ${errorMsg}`, responseData);
    throw new Error(errorMsg); 
  }
  
  if (responseData && (responseData.result === 0 || responseData.Error || responseData.reason || responseData.error)) {
    const dvachErrorMsg = responseData.reason || responseData.Error || responseData.error?.message || "Unknown Dvach API error (forwarded by /api/dvach-post)";
    console.error('[dvachService/postWithSessionCookie] Dvach API indicated an error (via /api/dvach-post):', dvachErrorMsg, responseData);
    throw new Error(dvachErrorMsg);
  }

  if (!responseData || ((responseData.result !== 1 && responseData.result !== 2) && !responseData.num && !responseData.target && !responseData.thread)) {
     console.error('[dvachService/postWithSessionCookie] Post success reported by /api/dvach-post, but Dvach response format unexpected or missing post/thread number.', responseData);
     throw new Error('Post attempt seemed successful (via /api/dvach-post) but Dvach response format was unexpected or lacked a post/thread number.');
  }

  if (responseData.num) responseData.num = String(responseData.num);
  if (responseData.thread) responseData.thread = String(responseData.thread);
  if (responseData.target) responseData.target = String(responseData.target);

  console.info('[dvachService/postWithSessionCookie] Post creation via /api/dvach-post successful:', responseData);
  return responseData;
}


export function extractDvachApiError(error: any): DvachApiError | null {
  if (!error) return null;

  let messageToParse = error.message || (typeof error === 'string' ? error : null);
  
  // If error object itself has Dvach's structure
  if (error.result === 0 && (error.reason || error.Error)) {
    return { code: -1, message: error.reason || error.Error };
  }
  if (error.error && typeof error.error.code === 'number' && typeof error.error.message === 'string') {
    return { code: error.error.code, message: error.error.message };
  }

  if (messageToParse) {
    try { // Attempt to parse if error.message is a JSON string from serverless function
      const parsedOuterError = JSON.parse(messageToParse);
      if (parsedOuterError.result === 0 && (parsedOuterError.reason || parsedOuterError.Error)) {
        return { code: -1, message: parsedOuterError.reason || parsedOuterError.Error };
      }
      if (parsedOuterError.error && typeof parsedOuterError.error.code === 'number' && typeof parsedOuterError.error.message === 'string') {
        return { code: parsedOuterError.error.code, message: parsedOuterError.error.message };
      }
    } catch (e) { /* Not a JSON string encapsulating another error */ }

    // Regex for specific Dvach error patterns in a plain string message
    const matchCode = messageToParse.match(/Error code (-?\d+)|Dvach API Error \((-?\d+)\)|error code: (-?\d+)|Banned: (-?\d+)|Ban: (-?\d+)|error: (-?\d+)/i);
    const code = matchCode ? parseInt(matchCode[1] || matchCode[2] || matchCode[3] || matchCode[4] || matchCode[5] || matchCode[6], 10) : -999; // Default unknown error code
    return { code: code, message: messageToParse };
  }
  
  return null; // Could not extract specific Dvach error structure
}


export async function base64ToFile(base64: string, filename: string, mimeType: string): Promise<File> {
  const res = await fetch(`data:${mimeType};base64,${base64}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: mimeType });
}