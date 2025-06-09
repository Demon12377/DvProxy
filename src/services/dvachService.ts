/// <reference types="vite/client" />
import { DvachThreadResponse, DvachPostApiResponse, DvachApiError, ProxyModeForGET, DvachSessionCookies } from '../types';
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
      console.warn("[dvachService] buildProxiedGetUrl called with 'vercel_serverless', this indicates an issue if targetUrl is external. Fetch should be to local API.");
      return targetUrl; 

    case 'custom_go_x2u':
      return `${customProxyUrl || PROXY_URL_GO_X2U_BASE}${encodeURIComponent(targetUrl)}`;

    case 'custom_cors_anywhere':
      const corsAnywhereBase = (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY).endsWith('/') 
          ? (customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY) 
          : `${(customProxyUrl || DEFAULT_CORS_ANYWHERE_PROXY)}/`;
      return `${corsAnywhereBase}${targetUrl}`;

    case 'custom_general_prefix':
      if (!customProxyUrl) return targetUrl; 
      return customProxyUrl.endsWith('/') ? `${customProxyUrl}${targetUrl}` : `${customProxyUrl}/${targetUrl}`;
      
    case 'custom_general_param':
      if (!customProxyUrl) return targetUrl; 
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
  let targetDvachUrl: string | undefined;

  if (proxyModeForGET === 'vercel_serverless') {
    fetchUrl = `/api/get-thread?board=${encodeURIComponent(board)}&thread=${encodeURIComponent(threadId)}`;
    console.info(`[dvachService/getThreadData] Fetching via Vercel Serverless: ${fetchUrl}`);
  } else {
    targetDvachUrl = `https://2ch.hk/${board}/res/${threadId}.json`; // Assuming 2ch.hk, could be made dynamic from DVACH_DOMAINS
    fetchUrl = buildProxiedGetUrl(targetDvachUrl, proxyModeForGET, customProxyUrlForGET);
    console.info(`[dvachService/getThreadData] Fetching thread. Mode: ${proxyModeForGET}. URL: ${fetchUrl} (target: ${targetDvachUrl})`);
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
    throw new Error(`Network error while fetching thread: ${(networkError as Error).message}. URL: ${fetchUrl}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Could not retrieve error text.");
    console.error(`[dvachService/getThreadData] Failed to fetch thread ${board}/${threadId} from ${fetchUrl}. Status: ${response.status}. Response: ${errorText.substring(0,500)}`);
    throw new Error(`Failed to fetch thread: ${response.status} ${response.statusText}. URL: ${fetchUrl}. Server/Proxy response: ${errorText.substring(0,200)}`);
  }

  let data: DvachThreadResponse;
  try {
    const rawData = await response.json();
     if (rawData.threads && rawData.threads[0] && rawData.threads[0].posts) {
        rawData.threads[0].posts = rawData.threads[0].posts.map((post: any) => ({
            ...post,
            num: String(post.num),
            parent: String(post.parent),
        }));
    }
    data = rawData as DvachThreadResponse;

  } catch (jsonError) {
    const responseTextFallback = "Could not get text after JSON parse failed.";
    const responseTextIfAvailable = response.bodyUsed ? responseTextFallback : await response.text().catch(() => responseTextFallback);
    console.error(`[dvachService/getThreadData] Failed to parse JSON response from ${fetchUrl}. Error:`, jsonError, "Response text:", responseTextIfAvailable.substring(0, 500));
    throw new Error(`Invalid JSON response from ${fetchUrl}. Check proxy or API. Details: ${responseTextIfAvailable.substring(0,200)}`);
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
        'X-User-Agent': userAgent,
      },
      body: JSON.stringify({ purchased_passcode: purchasedPasscode }),
    });
  } catch (networkError) {
    console.error('[dvachService/loginToDvach] Network error calling /api/dvach-login:', networkError);
    throw new Error(`Network error calling login API: ${(networkError as Error).message}`);
  }

  const responseData: DvachPostApiResponse = await response.json();

  if (!response.ok || responseData.result !== 1 || !responseData.passcode_auth_cookie_value) {
    const errorMsg = responseData?.error?.message || responseData?.reason || responseData?.Error || `Dvach login failed. Status: ${response.status}.`;
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
 * @param threadIdForDvach Thread ID to post in, or "0"/empty for new thread.
 * @param comment Post content.
 * @param file Optional file to attach.
 * @param parentPostNumForDvach Optional. Specific post number being replied to.
 * @param useSage Whether to use sage.
 * @param userAgent The User-Agent string for the request.
 * @returns Promise resolving to Dvach's API response forwarded by the serverless function.
 */
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
    throw new Error("passcode_auth session cookie is missing. Cannot post.");
  }

  console.info('[dvachService/postWithSessionCookie] Preparing data for /api/dvach-post. Params:', { board, threadIdForDvach, commentLength: comment.length, hasFile: !!file, parentPostNumForDvach, useSage });
  
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
    if (!responseBodyText) {
        const errorDetail = `Status: ${response.status} ${response.statusText}. Response body was empty.`;
        if (!response.ok) throw new Error(`Serverless function /api/dvach-post error: ${errorDetail}`);
        throw new Error(`Serverless function /api/dvach-post returned OK but with an empty response body. Check serverless logs.`);
    }
    responseData = JSON.parse(responseBodyText);
  } catch (e) {
    console.error(`[dvachService/postWithSessionCookie] Error processing /api/dvach-post response. Status: ${response.status}. Text: "${responseBodyText.substring(0,500)}". Parse/Error:`, e);
    const baseErrorMsg = `Serverless function /api/dvach-post error. Status: ${response.status} ${response.statusText}. Raw response: ${responseBodyText.substring(0,200)}.`;
    if (response.ok && e instanceof SyntaxError) {
        throw new Error(`${baseErrorMsg} Response was not valid JSON. Error: ${(e as Error).message}`);
    } else {
        throw new Error(`${baseErrorMsg} Error: ${(e as Error).message}`);
    }
  }
  
  if (!response.ok) {
    const errorMsg = responseData?.reason || responseData?.Error || (responseData?.error?.message) || `Posting failed (via /api/dvach-post). Status ${response.status}.`;
    console.error(`[dvachService/postWithSessionCookie] Failed to create post via /api/dvach-post. Serverless Status: ${response.status}. Dvach/Serverless Message: ${errorMsg}`, responseData);
    throw new Error(errorMsg); 
  }
  
  if (responseData && (responseData.result === 0 || responseData.Error || responseData.reason || responseData.error)) {
    const dvachErrorMsg = responseData.reason || responseData.Error || responseData.error?.message || "Unknown Dvach API error (via /api/dvach-post)";
    console.error('[dvachService/postWithSessionCookie] Dvach API indicated an error (via /api/dvach-post):', dvachErrorMsg, responseData);
    throw new Error(dvachErrorMsg);
  }

  if (!responseData || (responseData.result !== 1 && !responseData.num && !responseData.target && !responseData.thread)) {
     console.error('[dvachService/postWithSessionCookie] Post success reported by /api/dvach-post, but response format unexpected or missing post/thread number.', responseData);
     throw new Error('Post attempt successful (via /api/dvach-post) but Dvach response format was unexpected or lacked a post/thread number.');
  }

  if (responseData.num) responseData.num = String(responseData.num);
  if (responseData.thread) responseData.thread = String(responseData.thread);
  if (responseData.target) responseData.target = String(responseData.target);

  console.info('[dvachService/postWithSessionCookie] Post creation via /api/dvach-post successful:', responseData);
  return responseData;
}


export function extractDvachApiError(error: any): DvachApiError | null {
  if (error && typeof error.message === 'string') {
    try {
      const parsedError = JSON.parse(error.message);
      if (parsedError && typeof parsedError.code === 'number' && typeof parsedError.message === 'string') {
        return parsedError as DvachApiError;
      }
    } catch (e) { /* Not a JSON string */ }

    if(error.code !== undefined && error.message !== undefined && typeof error.code === 'number'){
        return { code: error.code, message: error.message };
    }
    
    const match = error.message.match(/Error code (-?\d+)|Dvach API Error \((-?\d+)\)/i);
    if (match) {
      const code = parseInt(match[1] || match[2], 10);
      return { code: code, message: error.message };
    }
     if (error.result === 0 && (error.reason || error.Error)) {
        return { code: -1, message: error.reason || error.Error }; 
    }
  }
  return null;
}

export async function base64ToFile(base64: string, filename: string, mimeType: string): Promise<File> {
  const res = await fetch(`data:${mimeType};base64,${base64}`);
  const blob = await res.blob();
  return new File([blob], filename, { type: mimeType });
}