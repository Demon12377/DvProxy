// A simplified user agent generator. For more robust generation, a dedicated library might be better.
// This mimics the 'user_agent' Python library's desktop user agents.

const osChoices = [
  { name: 'Windows NT 10.0; Win64; x64', chromeVersion: () => `Chrome/${Math.floor(Math.random() * 20) + 100}.0.${Math.floor(Math.random() * 1000)}.${Math.floor(Math.random() * 100)}` },
  { name: 'Macintosh; Intel Mac OS X 10_15_7', chromeVersion: () => `Chrome/${Math.floor(Math.random() * 20) + 100}.0.${Math.floor(Math.random() * 1000)}.${Math.floor(Math.random() * 100)}` },
  { name: 'X11; Linux x86_64', chromeVersion: () => `Chrome/${Math.floor(Math.random() * 20) + 100}.0.${Math.floor(Math.random() * 1000)}.${Math.floor(Math.random() * 100)}` }
];

const browserSuffixes = [
  (chromeVersion: string) => `${chromeVersion} Safari/537.36`,
  (chromeVersion: string) => `${chromeVersion} Safari/537.36 Edg/${Math.floor(Math.random() * 10) + 100}.0.${Math.floor(Math.random() * 1000)}.${Math.floor(Math.random() * 100)}`, // More realistic Edge UA
];

export function generateUserAgent(): string {
  const os = osChoices[Math.floor(Math.random() * osChoices.length)];
  const chromeVer = os.chromeVersion();
  const suffix = browserSuffixes[Math.floor(Math.random() * browserSuffixes.length)](chromeVer);
  
  return `Mozilla/5.0 (${os.name}) AppleWebKit/537.36 (KHTML, like Gecko) ${suffix}`;
}