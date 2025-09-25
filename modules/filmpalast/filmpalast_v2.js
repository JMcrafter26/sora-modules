/**
 * filmpalast.js
 * A module for Sora that provides watch functionality for filmpalast.to.
 * @module filmpalast
 * @author JMcrafte26
 * @license MIT
 * @version 1.2.3
 */

/**
 * Searches for films on filmpalast.to based on a keyword.
 * @param {string} keyword - The search keyword.
 * @returns {Promise<string>} - A JSON string of search results.
 */
async function searchResults(keyword) {
  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const html = await fetch(
      `https://filmpalast.to/search/title/${encodedKeyword}`
    );
    const filmListRegex =
      /<article class="liste glowliste  rb"[\s\S]*?<\/article>/g;
    const items = html.match(filmListRegex) || [];

    const results = [];

    let series = [];
    items.forEach((itemHtml, index) => {
      const titleMatch = itemHtml.match(
        /<a href="([^"]+)" class="rb" title="([^"]+)"[^>]*>([^<]+)<\/a>/
      );
      let title = titleMatch ? titleMatch[3] : "";
      const hrefMatch = itemHtml.match(
        /<a href="\/\/filmpalast.to\/stream\/([^"]+)"[^>]*>/
      );
      let href = hrefMatch
        ? `https://filmpalast.to/stream/${hrefMatch[1]}`
        : "";
      href = href.replace(/-s\d{2}e\d{2}/, "-s01e01");

      const imageMatch = itemHtml.match(
        /<img[^>]+src="([^"]+)"[^>]+class="cover-opacity"[^>]*>/
      );
      const image = "https://filmpalast.to" + (imageMatch ? imageMatch[1] : "");
      title = cleanTitle(title);

      // if title contains SxxExx, it's a series. Check if its in the series array, if not, add it
      if (title.match(/S\d{2}E\d{2}/)) {
        title = title.replace(/S\d{2}E\d{2}/, "").trim();

        if (!series.includes(title)) {
          series.push(title);
        } else {
          return;
        }
      }

      if (title && href) {
        results.push({
          title,
          image,
          href,
        });
      }
    });

    return JSON.stringify(results);
  } catch (error) {
    console.log("Fetch error: " + error);
    return JSON.stringify([{ title: "Error", image: "", href: "" }]);
  }
}

/**
 * Cleans the title by replacing HTML entities with their corresponding characters.
 * @param {string} title - The title to clean.
 * @returns {string} - The cleaned title.
 */
function cleanTitle(title) {
  return title
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Extracts details from a film's page.
 * @param {string} url - The URL of the film's page.
 * @returns {Promise<string>} - A JSON string of the film's details.
 */
async function extractDetails(url) {
  try {
    const html = await fetch(url);
    const descriptionMatch = html.match(
      /<span itemprop="description">([^<]+)<\/span>/
    );
    const description = descriptionMatch
      ? descriptionMatch[1]
      : "Error loading description";

    const durationMatch = html.match(/<br \/>Spielzeit: <em>([^<]+)<\/em>/);
    const duration = durationMatch ? durationMatch[1] : "Unknown";

    const airedMatch = html.match(/<br \/>Ver&ouml;ffentlicht: (\d{4})/);
    const aired = airedMatch ? airedMatch[1] : "Unknown";

    const transformedResults = [
      {
        description,
        aliases: `Duration: ${duration}`,
        airdate: `Aired: ${aired}`,
      },
    ];
    return JSON.stringify(transformedResults);
  } catch (error) {
    console.log("Details error: " + error);
    return JSON.stringify([
      {
        description: "Error loading description",
        aliases: "Duration: Unknown",
        airdate: "Aired: Unknown",
      },
    ]);
  }
}

/**
 * Extracts episodes from a film's page.
 * @param {string} url - The URL of the film's page.
 * @returns {Promise<string>} - A JSON string of the episodes.
 */
async function extractEpisodes(url) {
  try {
    const match = url.match(/https:\/\/filmpalast\.to\/stream\/(.+)$/);
    if (!match) {
      return JSON.stringify([{ number: "0", href: "" }]);
    }

    const html = await fetch(url);
    if (!isSeries(html)) {
      console.log("No seasons found - Probably a movie");
      return JSON.stringify([{ number: "0", href: url }]);
    }

    const ulMatch = html.match(
      /<ul class="staffelEpisodenList">([\s\S]+)<\/ul>/
    );
    if (!ulMatch) {
      console.log("No episodes found");
      return JSON.stringify([{ number: "0", href: "" }]);
    }

    const ul = ulMatch[1];
    const episodes = [];
    const liRegex = /<li class="stitle">([\s\S]+?)<\/li>/g;
    let liMatch;
    while ((liMatch = liRegex.exec(ul)) !== null) {
      const li = liMatch[1];
      const hrefMatch = li.match(/href="([^"]+)"/);

      let href = hrefMatch ? `https:${hrefMatch[1]}` : "";

      const numberMatch = li.match(/data-sid="(\d+)"/);
      // data-sid + 1 because the first episode has data-sid="0"
      const number = numberMatch ? parseInt(numberMatch[1]) + 1 : 0;

      console.log("Number Match: " + number + " type: " + typeof number);

      episodes.push({ number, href });
    }

    return JSON.stringify(episodes);
  } catch (error) {
    console.log("Fetch error: " + error);
  }
}

/**
 * Checks if the page is a series.
 * @param {string} html - The HTML of the page.
 * @returns {boolean} - True if the page is a series, false otherwise.
 *
 */
function isSeries(html) {
  // check if ul elemet with class staffelEpisodenList exists
  return html.includes('class="staffelEpisodenList"');
}

/**
 * Extracts the stream URL from a film's page.
 * @param {string} url - The URL of the film's page.
 * @returns {Promise<string|null>} - The stream URL or null if not found.
 *
 */
async function extractStreamUrl(url) {
  try {
    const response = await fetch(url);
    if (!response) {
      console.log("Response not found");
      return null;
    }
    const html = response.text ? await response.text() : response;
    
    if (!html) {
      console.log("HTML not found");
      return null;
    }

    const hosters = await selectHoster(html);
    console.log("Hosters found: " + hosters);

     try {
        // Inside extractStreamUrl function
        let streams = await multiExtractor(hosters);
        let returnedStreams = {
            streams: streams,
        };
        sendLog("Returned Streams: " + JSON.stringify(returnedStreams));
        // Check if the returned streams are not empty
        // Return the streams as a JSON string
    return JSON.stringify(returnedStreams);
    } catch (error) {
        console.log("Error extracting stream URL: " + error);
        return null;
    }
  } catch (error) {
    console.log("Fetch error: " + error);
    return null;
  }
}


async function selectHoster(html) {
  // console.log(html);
  // get all hosters from the page
  const hosterRegex =
    /<ul class="currentStreamLinks"[\s\S]*?<p class="hostName">([^<]+)<\/p>[\s\S]*?<a[^>]+class="button rb iconPlay"[^>]+href="([^"]+)"[^>]*>/g;
  const hosters = {};
  // get all hosters
  let match;
  while ((match = hosterRegex.exec(html)) !== null) {
       // providers = {
    //   "https://vidmoly.to/embed-preghvoypr2m.html": "vidmoly",
    //   "https://speedfiles.net/40d98cdccf9c": "speedfiles",
    //   "https://speedfiles.net/82346fs": "speedfiles",
    // };
    let hosterName = match[1];
    hosterName = hosterName.replace(" HD", "").toLowerCase();
    let hosterUrl = match[2];
    hosters[hosterUrl] = hosterName;
  }

  return hosters;
}

function sendLog(message) {
  // Check if the message is a string
  if (typeof message !== "string") {
    console.error("Message is not a string:", message);
    return;
  }
  // Send the log message to the console
  console.log(message);
}

/**
 * Decodes a base64 encoded string.
 * @param {string} str - The base64 encoded string.
 * @returns {string} - The decoded string.
 */
function base64Decode(str) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";

  str = String(str).replace(/=+$/, "");

  if (str.length % 4 === 1) {
    throw new Error(
      "'atob' failed: The string to be decoded is not correctly encoded."
    );
  }

  for (
    let bc = 0, bs, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }

  return output;
}


// if is node
if (typeof module !== "undefined" && module.exports) {
  console.log("Running in Node.js");
  console.log(extractStreamUrl("https://filmpalast.to/stream/final-destination-bloodlines"));
}


// ⚠️ DO NOT EDIT BELOW THIS LINE ⚠️
// EDITING THIS FILE COULD BREAK THE UPDATER AND CAUSE ISSUES WITH THE EXTRACTOR
/* {GE START} */
/* {VERSION: 1.1.3} */

/**
 * @name global_extractor.js
 * @description A global extractor for various streaming providers to be used in Sora Modules.
 * @author Cufiy
 * @url https://github.com/JMcrafter26/sora-global-extractor
 * @license CUSTOM LICENSE - see https://github.com/JMcrafter26/sora-global-extractor/blob/main/LICENSE
 * @date 2025-07-23 17:47:48
 * @version 1.1.3
 * @note This file was generated automatically.
 * The global extractor comes with an auto-updating feature, so you can always get the latest version. https://github.com/JMcrafter26/sora-global-extractor#-auto-updater
 */


function globalExtractor(providers) {
  for (const [url, provider] of Object.entries(providers)) {
    try {
      const streamUrl = extractStreamUrlByProvider(url, provider);
      // check if streamUrl is not null, a string, and starts with http or https
      if (streamUrl && typeof streamUrl === "string" && (streamUrl.startsWith("http"))) {
        return streamUrl;
      }
    } catch (error) {
      // Ignore the error and try the next provider
    }
  }
  return null;
}

async function multiExtractor(providers) {
  /* this scheme should be returned as a JSON object
  {
  "streams": [
    "FileMoon",
    "https://filemoon.example/stream1.m3u8",
    "StreamWish",
    "https://streamwish.example/stream2.m3u8",
    "Okru",
    "https://okru.example/stream3.m3u8",
    "MP4",
    "https://mp4upload.example/stream4.mp4",
    "Default",
    "https://default.example/stream5.m3u8"
  ]
}
  */

  const streams = [];
  const providersCount = {};
  for (let [url, provider] of Object.entries(providers)) {
    try {
      // if provider starts with "direct-", then add the url to the streams array directly
      if (provider.startsWith("direct-")) {
        const directName = provider.slice(7); // remove "direct-" prefix
        if (directName && directName.length > 0) {
          streams.push(directName, url);
        } else {
          streams.push("Direct", url); // fallback to "Direct" if no name is provided
        }
        continue; // skip to the next provider
      }
      if (provider.startsWith("direct")) {
        provider = provider.slice(7); // remove "direct-" prefix
        if (provider && provider.length > 0) {
          streams.push(provider, url);
        } else {
          streams.push("Direct", url); // fallback to "Direct" if no name is provided
        }
      }

      let customName = null; // to store the custom name if provided

      // if the provider has - then split it and use the first part as the provider name
      if (provider.includes("-")) {
        const parts = provider.split("-");
        provider = parts[0]; // use the first part as the provider name
        customName = parts.slice(1).join("-"); // use the rest as the custom name
      }

      // check if providercount is not bigger than 3
      if (providersCount[provider] && providersCount[provider] >= 3) {
        console.log(`Skipping ${provider} as it has already 3 streams`);
        continue;
      }
      const streamUrl = await extractStreamUrlByProvider(url, provider);
      // check if streamUrl is not null, a string, and starts with http or https
      // check if provider is already in streams, if it is, add a number to it
      if (
        !streamUrl ||
        typeof streamUrl !== "string" ||
        !streamUrl.startsWith("http")
      ) {
        continue; // skip if streamUrl is not valid
      }

      // if customName is defined, use it as the name
      if (customName && customName.length > 0) {
        provider = customName;
      }

      if (providersCount[provider]) {
        providersCount[provider]++;
        streams.push(
          provider.charAt(0).toUpperCase() +
            provider.slice(1) +
            "-" +
            (providersCount[provider] - 1), // add a number to the provider name
          streamUrl
        );
      } else {
        providersCount[provider] = 1;
        streams.push(
          provider.charAt(0).toUpperCase() + provider.slice(1),
          streamUrl
        );
      }
    } catch (error) {
      // Ignore the error and try the next provider
    }
  }
  return streams;
}

async function extractStreamUrlByProvider(url, provider) {
  if (eval(`typeof ${provider}Extractor`) !== "function") {
    // skip if the extractor is not defined
    console.log(`Extractor for provider ${provider} is not defined, skipping...`);
    return null;
  }
  let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": url,
    "Connection": "keep-alive",
    "x-Requested-With": "XMLHttpRequest"
  };
  if(provider == 'bigwarp') {
    delete headers["User-Agent"];
    headers["x-requested-with"] = "XMLHttpRequest";
  }
  // fetch the url
  // and pass the response to the extractor function
  console.log("Fetching URL: " + url);
  const response = await soraFetch(url, {
      headers
    });

  console.log("Response: " + response.status);
  let html = response.text ? await response.text() : response;
  // if title contains redirect, then get the redirect url
  const title = html.match(/<title>(.*?)<\/title>/);
  if (title && title[1].toLowerCase().includes("redirect")) {
    const redirectUrl = html.match(/<meta http-equiv="refresh" content="0;url=(.*?)"/);
    const redirectUrl2 = html.match(/window\.location\.href\s*=\s*["'](.*?)["']/);
    const redirectUrl3 = html.match(/window\.location\.replace\s*\(\s*["'](.*?)["']\s*\)/);
    if (redirectUrl) {
      console.log("Redirect URL: " + redirectUrl[1]);
      url = redirectUrl[1];
      html = await soraFetch(url, {
        headers
      });
      html = html.text ? await html.text() : html;

    } else if (redirectUrl2) {
      console.log("Redirect URL 2: " + redirectUrl2[1]);
      url = redirectUrl2[1];
      html = await soraFetch(url, {
        headers
      });
      html = html.text ? await html.text() : html;
    } else if (redirectUrl3) {
      console.log("Redirect URL 3: " + redirectUrl3[1]);
      url = redirectUrl3[1];
      html = await soraFetch(url, {
        headers
      });
      html = html.text ? await html.text() : html;
    } else {
      console.log("No redirect URL found");
    }
  }

  // console.log("HTML: " + html);
  switch (provider) {
    case "bigwarp":
      try {
         return await bigwarpExtractor(html, url);
      } catch (error) {
         console.log("Error extracting stream URL from bigwarp:", error);
         return null;
      }
    case "doodstream":
      try {
         return await doodstreamExtractor(html, url);
      } catch (error) {
         console.log("Error extracting stream URL from doodstream:", error);
         return null;
      }
    case "filemoon":
      try {
         return await filemoonExtractor(html, url);
      } catch (error) {
         console.log("Error extracting stream URL from filemoon:", error);
         return null;
      }
    case "mp4upload":
      try {
         return await mp4uploadExtractor(html, url);
      } catch (error) {
         console.log("Error extracting stream URL from mp4upload:", error);
         return null;
      }
    case "vidmoly":
      try {
         return await vidmolyExtractor(html, url);
      } catch (error) {
         console.log("Error extracting stream URL from vidmoly:", error);
         return null;
      }
    case "vidoza":
      try {
         return await vidozaExtractor(html, url);
      } catch (error) {
         console.log("Error extracting stream URL from vidoza:", error);
         return null;
      }
    case "voe":
      try {
         return await voeExtractor(html, url);
      } catch (error) {
         console.log("Error extracting stream URL from voe:", error);
         return null;
      }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}


////////////////////////////////////////////////
//                 EXTRACTORS                 //
////////////////////////////////////////////////

// DO NOT EDIT BELOW THIS LINE UNLESS YOU KNOW WHAT YOU ARE DOING //
/* --- bigwarp --- */

/**
 * 
 * @name bigWarpExtractor
 * @author Cufiy
 */
async function bigwarpExtractor(videoPage, url = null) {

  // regex get 'sources: [{file:"THIS_IS_THE_URL" ... '
  const scriptRegex = /sources:\s*\[\{file:"([^"]+)"/;
  // const scriptRegex =
  const scriptMatch = scriptRegex.exec(videoPage);
  const bwDecoded = scriptMatch ? scriptMatch[1] : false;
  console.log("BigWarp HD Decoded:", bwDecoded);
  return bwDecoded;
}
/* --- doodstream --- */

/**
 * @name doodstreamExtractor
 * @author Cufiy
 */
async function doodstreamExtractor(html, url = null) {
    console.log("DoodStream extractor called");
    console.log("DoodStream extractor URL: " + url);
        const streamDomain = url.match(/https:\/\/(.*?)\//, url)[0].slice(8, -1);
        const md5Path = html.match(/'\/pass_md5\/(.*?)',/, url)[0].slice(11, -2);
        const token = md5Path.substring(md5Path.lastIndexOf("/") + 1);
        const expiryTimestamp = new Date().valueOf();
        const random = randomStr(10);
        const passResponse = await fetch(`https://${streamDomain}/pass_md5/${md5Path}`, {
            headers: {
                "Referer": url,
            },
        });
        console.log("DoodStream extractor response: " + passResponse.status);
        const responseData = await passResponse.text();
        const videoUrl = `${responseData}${random}?token=${token}&expiry=${expiryTimestamp}`;
        console.log("DoodStream extractor video URL: " + videoUrl);
        return videoUrl;
}
function randomStr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}
/* --- filemoon --- */

/* {REQUIRED PLUGINS: unbaser} */
/**
 * @name filemoonExtractor
 * @author Cufiy - Inspired by Churly
 */
async function filemoonExtractor(html, url = null) {
    // check if contains iframe, if does, extract the src and get the url
    const regex = /<iframe[^>]+src="([^"]+)"[^>]*><\/iframe>/;
    const match = html.match(regex);
    if (match) {
        console.log("Iframe URL: " + match[1]);
        const iframeUrl = match[1];
        const iframeResponse = await soraFetch(iframeUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Referer": url,
            }
        });
        console.log("Iframe Response: " + iframeResponse.status);
        html = await iframeResponse.text();
    }
    // console.log("HTML: " + html);
    // get /<script[^>]*>([\s\S]*?)<\/script>/gi
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    const scripts = [];
    let scriptMatch;
    while ((scriptMatch = scriptRegex.exec(html)) !== null) {
        scripts.push(scriptMatch[1]);
    }
    // get the script with eval and m3u8
    const evalRegex = /eval\((.*?)\)/;
    const m3u8Regex = /m3u8/;
    // console.log("Scripts: " + scripts);
    const evalScript = scripts.find(script => evalRegex.test(script) && m3u8Regex.test(script));
    if (!evalScript) {
        console.log("No eval script found");
        return null;
    }
    const unpackedScript = unpack(evalScript);
    // get the m3u8 url
    const m3u8Regex2 = /https?:\/\/[^\s]+master\.m3u8[^\s]*?(\?[^"]*)?/;
    const m3u8Match = unpackedScript.match(m3u8Regex2);
    if (m3u8Match) {
        return m3u8Match[0];
    } else {
        console.log("No M3U8 URL found");
        return null;
    }
}


/* --- mp4upload --- */

/**
 * @name mp4uploadExtractor
 * @author Cufiy
 */
async function mp4uploadExtractor(html, url = null) {
    // src: "https://a4.mp4upload.com:183/d/xkx3b4etz3b4quuo66rbmyqtjjoivahfxp27f35pti45rzapbvj5xwb4wuqtlpewdz4dirfp/video.mp4"  
    const regex = /src:\s*"([^"]+)"/;
  const match = html.match(regex);
  if (match) {
    return match[1];
  } else {
    console.log("No match found for mp4upload extractor");
    return null;
  }
}
/* --- vidmoly --- */

/**
 * @name vidmolyExtractor
 * @author Ibro
 */
async function vidmolyExtractor(html, url = null) {
  const regexSub = /<option value="([^"]+)"[^>]*>\s*SUB - Omega\s*<\/option>/;
  const regexFallback = /<option value="([^"]+)"[^>]*>\s*Omega\s*<\/option>/;
  const fallback =
    /<option value="([^"]+)"[^>]*>\s*SUB v2 - Omega\s*<\/option>/;
  let match =
    html.match(regexSub) || html.match(regexFallback) || html.match(fallback);
  if (match) {
    const decodedHtml = atob(match[1]); // Decode base64
    const iframeMatch = decodedHtml.match(/<iframe\s+src="([^"]+)"/);
    if (!iframeMatch) {
      console.log("Vidmoly extractor: No iframe match found");
      return null;
    }
    const streamUrl = iframeMatch[1].startsWith("//")
      ? "https:" + iframeMatch[1]
      : iframeMatch[1];
    const responseTwo = await fetchv2(streamUrl);
    const htmlTwo = await responseTwo.text();
    const m3u8Match = htmlTwo.match(/sources:\s*\[\{file:"([^"]+\.m3u8)"/);
    return m3u8Match ? m3u8Match[1] : null;
  } else {
    console.log("Vidmoly extractor: No match found, using fallback");
    //  regex the sources: [{file:"this_is_the_link"}]
    const sourcesRegex = /sources:\s*\[\{file:"(https?:\/\/[^"]+)"\}/;
    const sourcesMatch = html.match(sourcesRegex);
    let sourcesString = sourcesMatch
      ? sourcesMatch[1].replace(/'/g, '"')
      : null;
    return sourcesString;
  }
}
/* --- vidoza --- */

/**
 * @name vidozaExtractor
 * @author Cufiy
 */
async function vidozaExtractor(html, url = null) {
  const regex = /<source src="([^"]+)" type='video\/mp4'>/;
  const match = html.match(regex);
  if (match) {
    return match[1];
  } else {
    console.log("No match found for vidoza extractor");
    return null;
  }
}
/* --- voe --- */

/**
 * @name voeExtractor
 * @author Cufiy
 */
function voeExtractor(html, url = null) {
// Extract the first <script type="application/json">...</script>
    const jsonScriptMatch = html.match(
      /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!jsonScriptMatch) {
      console.log("No application/json script tag found");
      return null;
    }

    const obfuscatedJson = jsonScriptMatch[1].trim();
  let data;
  try {
    data = JSON.parse(obfuscatedJson);
  } catch (e) {
    throw new Error("Invalid JSON input.");
  }
  if (!Array.isArray(data) || typeof data[0] !== "string") {
    throw new Error("Input doesn't match expected format.");
  }
  let obfuscatedString = data[0];
  // Step 1: ROT13
  let step1 = voeRot13(obfuscatedString);
  // Step 2: Remove patterns
  let step2 = voeRemovePatterns(step1);
  // Step 3: Base64 decode
  let step3 = voeBase64Decode(step2);
  // Step 4: Subtract 3 from each char code
  let step4 = voeShiftChars(step3, 3);
  // Step 5: Reverse string
  let step5 = step4.split("").reverse().join("");
  // Step 6: Base64 decode again
  let step6 = voeBase64Decode(step5);
  // Step 7: Parse as JSON
  let result;
  try {
    result = JSON.parse(step6);
  } catch (e) {
    throw new Error("Final JSON parse error: " + e.message);
  }
  // console.log("Decoded JSON:", result);
  // check if direct_access_url is set, not null and starts with http
  if (result && typeof result === "object") {
    const streamUrl =
      result.direct_access_url ||
      result.source
        .map((source) => source.direct_access_url)
        .find((url) => url && url.startsWith("http"));
    if (streamUrl) {
      console.log("Voe Stream URL: " + streamUrl);
      return streamUrl;
    } else {
      console.log("No stream URL found in the decoded JSON");
    }
  }
  return result;
}
function voeRot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13)
        ? c
        : c - 26
    );
  });
}
function voeRemovePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let result = str;
  for (const pat of patterns) {
    result = result.split(pat).join("");
  }
  return result;
}
function voeBase64Decode(str) {
  // atob is available in browsers and Node >= 16
  if (typeof atob === "function") {
    return atob(str);
  }
  // Node.js fallback
  return Buffer.from(str, "base64").toString("utf-8");
}
function voeShiftChars(str, shift) {
  return str
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) - shift))
    .join("");
}

////////////////////////////////////////////////
//                 PLUGINS                    //
////////////////////////////////////////////////

/**
 * Uses Sora's fetchv2 on ipad, fallbacks to regular fetch on Windows
 * @author ShadeOfChaos
 *
 * @param {string} url The URL to make the request to.
 * @param {object} [options] The options to use for the request.
 * @param {object} [options.headers] The headers to send with the request.
 * @param {string} [options.method='GET'] The method to use for the request.
 * @param {string} [options.body=null] The body of the request.
 *
 * @returns {Promise<Response|null>} The response from the server, or null if the
 * request failed.
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            await console.log('soraFetch error: ' + error.message);
            return null;
        }
    }
}

class Unbaser {
    constructor(base) {
        this.ALPHABET = {
            62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
            95: "' !\"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
        };
        this.dictionary = {};
        this.base = base;
        if (36 < base && base < 62) {
            this.ALPHABET[base] = this.ALPHABET[base] ||
                this.ALPHABET[62].substr(0, base);
        }
        if (2 <= base && base <= 36) {
            this.unbase = (value) => parseInt(value, base);
        }
        else {
            try {
                [...this.ALPHABET[base]].forEach((cipher, index) => {
                    this.dictionary[cipher] = index;
                });
            }
            catch (er) {
                throw Error("Unsupported base encoding.");
            }
            this.unbase = this._dictunbaser;
        }
    }
    _dictunbaser(value) {
        let ret = 0;
        [...value].reverse().forEach((cipher, index) => {
            ret = ret + ((Math.pow(this.base, index)) * this.dictionary[cipher]);
        });
        return ret;
    }
}
function unpack(source) {
    let { payload, symtab, radix, count } = _filterargs(source);
    if (count != symtab.length) {
        throw Error("Malformed p.a.c.k.e.r. symtab.");
    }
    let unbase;
    try {
        unbase = new Unbaser(radix);
    }
    catch (e) {
        throw Error("Unknown p.a.c.k.e.r. encoding.");
    }
    function lookup(match) {
        const word = match;
        let word2;
        if (radix == 1) {
            word2 = symtab[parseInt(word)];
        }
        else {
            word2 = symtab[unbase.unbase(word)];
        }
        return word2 || word;
    }
    source = payload.replace(/\b\w+\b/g, lookup);
    return _replacestrings(source);
    function _filterargs(source) {
        const juicers = [
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\), *(\d+), *(.*)\)\)/,
            /}\('(.*)', *(\d+|\[\]), *(\d+), *'(.*)'\.split\('\|'\)/,
        ];
        for (const juicer of juicers) {
            const args = juicer.exec(source);
            if (args) {
                let a = args;
                if (a[2] == "[]") {
                }
                try {
                    return {
                        payload: a[1],
                        symtab: a[4].split("|"),
                        radix: parseInt(a[2]),
                        count: parseInt(a[3]),
                    };
                }
                catch (ValueError) {
                    throw Error("Corrupted p.a.c.k.e.r. data.");
                }
            }
        }
        throw Error("Could not make sense of p.a.c.k.e.r data (unexpected code structure)");
    }
    function _replacestrings(source) {
        return source;
    }
}

 

/* {GE END} */