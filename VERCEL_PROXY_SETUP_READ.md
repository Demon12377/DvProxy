
# Guide: Vercel Serverless Proxy Configuration for Dvach API

This guide explains the Vercel environment variable setup used to route outbound requests from this project's serverless functions (e.g., `/api/dvach-login`, `/api/dvach-post`, `/api/get-thread`) through a user-specified proxy. This was implemented to bypass Cloudflare (or similar WAF) blocks that were causing `403 Forbidden` errors when Vercel's servers directly accessed `2ch.hk`.

## The Problem

Direct requests from Vercel's serverless functions to `2ch.hk` were often blocked by Cloudflare (or a similar Web Application Firewall). This was likely due to:
*   The IP address reputation of Vercel's shared server fleet.
*   Automated security systems flagging server-to-server requests without typical browser headers or behavior as suspicious.
The symptom was usually a `403 Forbidden` response with HTML content like "Just a moment..."

## The Solution

To circumvent these blocks, the serverless functions were modified to route their outbound HTTP requests to `2ch.hk` through a user-defined proxy server. This means:
1.  The client application (browser) calls the Vercel serverless function (e.g., `/api/dvach-login`).
2.  The Vercel serverless function, instead of directly calling `2ch.hk`, calls the specified proxy server.
3.  The proxy server then makes the request to `2ch.hk` on behalf of the serverless function.
Since the request to `2ch.hk` now originates from the proxy's IP address (which is hopefully not flagged), it's more likely to succeed.

## Vercel Environment Variables

Two environment variables must be configured in your Vercel project settings to enable and define this proxying behavior for the serverless functions:

| Key                             | Value Example                                                                | Description                                                                                                                                                                                                                                                                                          |
| :------------------------------ | :--------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DVACH_OUTBOUND_PROXY_URL`      | `https://go.x2u.in/proxy?email=your_email@example.com&apiKey=your_api_key&url=` | The **full base URL** of the proxy server that your Vercel serverless functions will use. The serverless functions will append the encoded target Dvach URL to this proxy URL based on the `DVACH_OUTBOUND_PROXY_TYPE`.                                                                         |
| `DVACH_OUTBOUND_PROXY_TYPE`     | `general_param`                                                              | Specifies how the target Dvach URL should be appended to the `DVACH_OUTBOUND_PROXY_URL`.<br/>- **`general_param`**: Appends the URL-encoded target Dvach URL as a parameter. Expects `DVACH_OUTBOUND_PROXY_URL` to end with `&url=` or similar (e.g., for `go.x2u.in`).<br/>- **`prefix`**: Prepends `DVACH_OUTBOUND_PROXY_URL` to the target Dvach URL. Expects `DVACH_OUTBOUND_PROXY_URL` to be a base path (e.g., `https://my-cors-proxy.com/`). If your proxy URL doesn't end with `/`, the serverless functions will add it. |

**Example for `go.x2u.in`:**
*   `DVACH_OUTBOUND_PROXY_URL`: `https://go.x2u.in/proxy?email=early4@punkproof.com&apiKey=d97e1643&url=`
*   `DVACH_OUTBOUND_PROXY_TYPE`: `general_param`

**Example for a typical CORS Anywhere prefix proxy:**
*   `DVACH_OUTBOUND_PROXY_URL`: `https://my-custom-cors-anywhere.herokuapp.com/`
*   `DVACH_OUTBOUND_PROXY_TYPE`: `prefix`

If `DVACH_OUTBOUND_PROXY_URL` is not set, the serverless functions will attempt to connect to `2ch.hk` directly (which was the original failing behavior).

## Serverless Function Logic

The JavaScript code in `api/get-thread/index.js`, `api/dvach-login/index.js`, and `api/dvach-post/index.js` checks for these environment variables:
```javascript
// Simplified example from one of the serverless functions
const OUTBOUND_PROXY_URL = process.env.DVACH_OUTBOUND_PROXY_URL;
const OUTBOUND_PROXY_TYPE = process.env.DVACH_OUTBOUND_PROXY_TYPE;

function buildProxiedUrlForServerless(targetDvachUrl) {
  if (!OUTBOUND_PROXY_URL) {
    return targetDvachUrl; // No proxy configured, fetch directly
  }
  if (OUTBOUND_PROXY_TYPE === 'general_param') {
    return `${OUTBOUND_PROXY_URL}${encodeURIComponent(targetDvachUrl)}`;
  }
  if (OUTBOUND_PROXY_TYPE === 'prefix') {
    const proxyBase = OUTBOUND_PROXY_URL.endsWith('/') ? OUTBOUND_PROXY_URL : `${OUTBOUND_PROXY_URL}/`;
    return `${proxyBase}${targetDvachUrl}`;
  }
  // ... fallback logic ...
}

// Later, when making a fetch call:
// const targetDvachUrl = 'https://2ch.hk/b/res/123.json';
// const finalFetchUrl = buildProxiedUrlForServerless(targetDvachUrl);
// await fetch(finalFetchUrl, { /* ... headers ... */ });
```

## How to Configure on Vercel

1.  Go to your project on [Vercel](https://vercel.com/).
2.  Navigate to the **Settings** tab.
3.  In the left sidebar, select **Environment Variables**.
4.  Add the two variables:
    *   `DVACH_OUTBOUND_PROXY_URL` with your proxy's base URL.
    *   `DVACH_OUTBOUND_PROXY_TYPE` with either `general_param` or `prefix`.
5.  Ensure they are set for the correct **Environments** (e.g., "Production", "Preview", "Development"). "All Environments" is usually a safe choice.
6.  Click **Save**.

![Vercel Environment Variables Setup Example](https://user-images.githubusercontent.com/your-username/your-repo/path-to-your-screenshot.png) 
*(You'll need to replace this image link with an actual screenshot if you have one, or describe the UI. The user provided a screenshot previously, which this refers to.)*

As seen in your screenshot:
![User Provided Vercel Env Var Screenshot](https://i.imgur.com/V22tKrx.png)
This setup is correct for the `go.x2u.in` proxy.

## Important: Redeployment

After adding or changing environment variables on Vercel, you **must trigger a new deployment** for the changes to take effect. Existing deployments will continue to use the old (or no) environment variables.
You can do this by:
*   Pushing a new commit to your connected Git repository.
*   Manually redeploying an existing deployment from the Vercel dashboard.

This setup ensures that your serverless functions can reliably communicate with the Dvach API by using a proxy, thus bypassing potential IP-based blocks or WAF challenges.
