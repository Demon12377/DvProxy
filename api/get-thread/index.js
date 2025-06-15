// api/get-thread/index.js
import fetch from 'node-fetch';

const DEFAULT_DVACH_USER_AGENT_FOR_SERVERLESS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DVACH_BASE_URL = 'https://2ch.hk'; // This is the target Dvach domain

// Environment variables for server-side outbound proxy
const OUTBOUND_PROXY_URL = process.env.DVACH_OUTBOUND_PROXY_URL;
const OUTBOUND_PROXY_TYPE = process.env.DVACH_OUTBOUND_PROXY_TYPE; // e.g., 'general_param', 'prefix'

function buildProxiedUrlForServerless(targetDvachUrl) {
  if (!OUTBOUND_PROXY_URL) {
    return targetDvachUrl; // No proxy configured, fetch directly
  }
  if (OUTBOUND_PROXY_TYPE === 'general_param') {
    // Assumes proxy URL ends with '...&url=' or '...&uri=' or similar
    return `${OUTBOUND_PROXY_URL}${encodeURIComponent(targetDvachUrl)}`;
  }
  if (OUTBOUND_PROXY_TYPE === 'prefix') {
    // Assumes proxy URL is a prefix like 'https://myproxy.com/'
    const proxyBase = OUTBOUND_PROXY_URL.endsWith('/') ? OUTBOUND_PROXY_URL : `${OUTBOUND_PROXY_URL}/`;
    return `${proxyBase}${targetDvachUrl}`;
  }
  // If type is unknown or not set but URL is, try prefix as a guess or log warning
  console.warn(`[api/get-thread] DVACH_OUTBOUND_PROXY_URL is set, but DVACH_OUTBOUND_PROXY_TYPE ('${OUTBOUND_PROXY_TYPE}') is unrecognized. Attempting direct connection or simple prefix proxy.`);
  const proxyBase = OUTBOUND_PROXY_URL.endsWith('/') ? OUTBOUND_PROXY_URL : `${OUTBOUND_PROXY_URL}/`;
  return `${proxyBase}${targetDvachUrl}`; // Fallback to prefix if type is bad but URL exists
}


export default async function handler(req, res) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} [api/get-thread] Request received. Method: ${req.method}, URL: ${req.url}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Agent'); 

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'CORS preflight successful for /api/get-thread' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: { code: 405, message: `Method Not Allowed. Only GET requests are accepted for /api/get-thread. Received: ${req.method}` } });
  }

  const { board, thread } = req.query;
  const clientUserAgent = req.headers['x-user-agent'] || DEFAULT_DVACH_USER_AGENT_FOR_SERVERLESS;


  if (!board || !thread) {
    console.warn(`${timestamp} [api/get-thread] Missing board or thread query parameters.`);
    return res.status(400).json({ error: { code: 400, message: 'Board and thread query parameters are required (e.g., /api/get-thread?board=b&thread=12345)' } });
  }

  const targetDvachUrl = `${DVACH_BASE_URL}/${board}/res/${thread}.json`;
  const finalFetchUrl = buildProxiedUrlForServerless(targetDvachUrl);
  
  console.log(`${timestamp} [api/get-thread] Fetching. Final URL: ${finalFetchUrl}, Target Dvach: ${targetDvachUrl}, UA: ${clientUserAgent}, Outbound Proxy Used: ${OUTBOUND_PROXY_URL ? 'Yes ('+OUTBOUND_PROXY_TYPE+')' : 'No'}`);

  try {
    const dvachResponse = await fetch(finalFetchUrl, {
      headers: {
        'User-Agent': clientUserAgent, 
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8',
        'Referer': `${DVACH_BASE_URL}/${board}/`, // Referer for the target Dvach site
        'Origin': DVACH_BASE_URL, // Origin for the target Dvach site
      }
    });

    const responseBodyText = await dvachResponse.text();

    if (!dvachResponse.ok) {
      console.error(`${timestamp} [api/get-thread] Error from external fetch. Status: ${dvachResponse.status}. URL: ${finalFetchUrl}. Response: ${responseBodyText.substring(0, 500)}`);
      try {
        const errorJson = JSON.parse(responseBodyText);
        res.setHeader('Content-Type', 'application/json');
        return res.status(dvachResponse.status).json(errorJson);
      } catch (e) {
        res.setHeader('Content-Type', 'application/json'); 
        return res.status(dvachResponse.status).json({ error: { code: dvachResponse.status, message: `Dvach API/Proxy error: ${responseBodyText.substring(0, 200)}` }});
      }
    }
    
    let threadData;
    try {
        threadData = JSON.parse(responseBodyText);
    } catch(e) {
        console.error(`${timestamp} [api/get-thread] External response was OK but not valid JSON. URL: ${finalFetchUrl}. Response: ${responseBodyText.substring(0,500)}`);
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).json({ error: { code: 500, message: `External service returned OK but response was not valid JSON. ${responseBodyText.substring(0,200)}`}});
    }
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(threadData);

  } catch (error) {
    console.error(`${timestamp} [api/get-thread] Internal server error:`, error);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: { code: 500, message: `Internal server error in /api/get-thread: ${error.message}` } });
  }
}