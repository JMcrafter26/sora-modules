async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        sendLog("searchResults: keyword =", keyword);
        sendLog("searchResults: encodedKeyword =", encodedKeyword);

        const request = await soraFetch(
            `https://latanime.org/buscar?q=${encodedKeyword}`,
            {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
                    Accept:
                        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.5",
                    Referer: "https://latanime.org/",
                    Connection: "keep-alive",
                },
            }
        );


        const response = (await request.text) ? await request.text() : request;
        // sendLog(response);
        sendLog("searchResults: response length =", response.length);


        // 1. Verify search results header exists
        if (!response.includes("Resultados de la bÃºsqueda para") || !response.includes("Resultados de la búsqueda para")) {
            sendLog("No search results header found");
            // sendLog("html response:", response);
            // return JSON.stringify([
            //     { title: "No results found", image: "", href: "" },
            // ]);
        }

        // 2. Find the start of the cards container
        const rowStart = response.indexOf('<div class="row">');
        if (rowStart === -1) {
            sendLog("Could not find cards container start");
            return JSON.stringify([
                { title: "No results found", image: "", href: "" },
            ]);
        }

        // 3. Find the end of the cards container
        const rowEnd = response.indexOf("</a></div>", rowStart) + 10;
        let cardsHtml = response.substring(rowStart, rowEnd);
        sendLog("cardsHtml preview:", cardsHtml.substring(0, 1000));

        sendLog("Cards container length:", cardsHtml.length);

        let cardIndex = 0;
        const cards = [];
        const cardRegex = /<div class="col-md-4 col-lg-3 col-xl-2 col-6 my-3">([\s\S]*?)<\/a><\/div>/g;
        let match;

        while ((match = cardRegex.exec(cardsHtml)) !== null) {
            const cardContent = match[0];
            cardIndex++;

            const hrefMatch = cardContent.match(/<a\s+href="([^"]+)"/);
            const imgMatch = cardContent.match(/<img[^>]+src="([^"]+)"/);
            const titleMatch = cardContent.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);

            if (hrefMatch && imgMatch && titleMatch) {
                const href = hrefMatch[1];
                const image = imgMatch[1];
                const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
                const typeMatch = cardContent.match(/<span class="opacity-75">([^<]+)<\/span>/);
                const yearMatch = cardContent.match(/(\d{4})<\/span>/);

                cards.push({
                    href,
                    image,
                    title,
                    type: typeMatch ? typeMatch[1] : "Unknown",
                    year: yearMatch ? yearMatch[1] : "Unknown"
                });
            } else {
                sendLog(`Card ${cardIndex}: Missing data`);
            }
        }



        sendLog("Total cards found:", cards.length);

        return cards.length > 0
            ? JSON.stringify(cards)
            : JSON.stringify([{ title: "No results found", image: "", href: "" }]);
    } catch (error) {
        sendLog("Error:", error);
        return JSON.stringify([{ title: "Error", image: "", href: "" }]);
    }
}


async function extractDetails(url) {
  try {
    const response = await soraFetch(url);
    const html = await response.text ? await response.text() : response;
    
// get description, aliases, airdate

// description regex: p class="my-2 opacity-75"
    const descriptionMatch = html.match(/p class="my-2 opacity-75">([\s\S]*?)<\/p>/);

    // airdate regex: <div class="my-2"><span class="span-tiempo fs-6">Estreno: 11 de Enero de 2025</span></div>  
    const airdateMatch = html.match(/<div class="my-2"><span class="span-tiempo fs-6">Estreno: ([^<]+)<\/span><\/div>/);

    // episodes regex: <p>Episodios: 14</p>
    const episodesMatch = html.match(/<p>Episodios:\s*(\d+)<\/p>/);


    const transformedResults = [
      {
        description: descriptionMatch ? descriptionMatch[1] : "No description available",
        aliases: `Episodes: ${episodesMatch ? episodesMatch[1] : "Unknown"}`,
        airdate: `Aired: ${airdateMatch ? airdateMatch[1] : "Unknown"}`,
      },
    ];

    // sendLog("Details extracted:", transformedResults);

    return JSON.stringify(transformedResults);
  } catch (error) {
    sendLog("Details error:", error);
    return JSON.stringify([
      {
        description: "Error loading description",
        aliases: "Duration: Unknown",
        airdate: "Aired: Unknown",
      },
    ]);
  }
}

async function extractEpisodes(url) {
  try {
        const response = await soraFetch(url);
    const data = await response.text ? await response.text() : response;
    
        /* html:
    <div style="max-height: 400px; overflow-y: auto;">
<a href="https://latanime.org/ver/sakamoto-days-latino-episodio-1">
<div class="p-2 cap-layout d-flex align-items-center gap-2">
  <img class="lozad rounded-3" style="width: 150px; height: 85px;" src="https://latanime.org/public/img/capblank.png" data-src="https://latanime.org/thumbs/portada/sakamoto-days-latino-1736607948.jpg?v=1.5" alt="Sakamoto Days Latino capitulo 1">
   Sakamoto Days Latino - Capitulo 1
</div>
</a>
<a href="https://latanime.org/ver/sakamoto-days-latino-episodio-2">
<div class="p-2 cap-layout d-flex align-items-center gap-2">
  <img class="lozad rounded-3" style="width: 150px; height: 85px;" src="https://latanime.org/public/img/capblank.png" data-src="https://latanime.org/assets/img/serie/episodio/sakamoto-days-latino-2-1737212259.jpg" alt="Sakamoto Days Latino capitulo 2">
   Sakamoto Days Latino - Capitulo 2
</div>
</a>
...*/

// only get 'number' and 'url' from the <a> tag 
    const episodeRegex = /<a\s+href="([^"]+)"[^>]*>\s*<div[^>]*>\s*<img[^>]+data-src="([^"]+)"[^>]*>\s*([^<]+)<\/div>\s*<\/a>/g;
    const episodes = [];
    let match;
    while ((match = episodeRegex.exec(data)) !== null) {
      const href = match[1];
      const number = parseInt(match[3].trim().split(" - ")[1].split(" ")[1]);


      episodes.push({ href, number });
    }
    sendLog("Total episodes found:", episodes.length);
    sendLog(episodes);
    if (episodes.length === 0) {
      return JSON.stringify([{ href: "", number: "" }]);
    }


    return JSON.stringify(episodes);
  } catch (error) {
    sendLog("Fetch error:", error);
  }
}


async function extractStreamUrl(url) {
  try {
    const response = await soraFetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3"
        }
    });
    const html = await response.text ? await response.text() : response;
    const playerRegex = /data-player="([^"]+)">([^<]+)<\/a>/g;
    const providers = {};

    // Extract providers from the HTML
    let match;
    while ((match = playerRegex.exec(html)) !== null) {
      const url = atob(match[1]);
      const name = match[2];
      providers[url] = name;
    }
    sendLog("Extracted providers:", providers);
let streams = [];
// Extract all available streams
try {
  streams = await multiExtractor(providers);
  let returnedStreams = {
    streams: streams,
  }

  sendLog("Multi extractor streams: " + JSON.stringify(returnedStreams));
  return JSON.stringify(returnedStreams);
} catch (error) {
  sendLog("Multi extractor error:" + error);
  return JSON.stringify([{ provider: "Error2", link: "" }]);
}
  } catch (error) {
    sendLog("Fetch error:", error);
    return null;
  }
}

async function sendLog(message, msg = null) {
    // send http://192.168.2.130/sora-module/log.php?action=add&message=message
    console.log(message, msg ? msg : "");

    return;
    await fetch('http://192.168.2.130/sora-module/log.php?action=add&message=' + encodeURIComponent(message) + (msg ? ' | ' + encodeURIComponent(msg) : ''))
    .catch(error => {
        console.error('Error sending log:', error);
    });
}


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
      if (
        streamUrl &&
        typeof streamUrl === "string" &&
        streamUrl.startsWith("http")
      ) {
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
        sendLog(`Skipping ${provider} as it has already 3 streams`);
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
    sendLog(
      `Extractor for provider ${provider} is not defined, skipping...`
    );
    return null;
  }
  let headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    Referer: url,
    Connection: "keep-alive",
    "x-Requested-With": "XMLHttpRequest",
  };
  if (provider == "bigwarp") {
    delete headers["User-Agent"];
    headers["x-requested-with"] = "XMLHttpRequest";
  }
  // fetch the url
  // and pass the response to the extractor function
  sendLog("Fetching URL: " + url);
  const response = await soraFetch(url, {
    headers,
  });

  sendLog("Response: " + response.status);
  let html = response.text ? await response.text() : response;
  // if title contains redirect, then get the redirect url
  const title = html.match(/<title>(.*?)<\/title>/);
  if (title && title[1].toLowerCase().includes("redirect")) {
    const redirectUrl = html.match(
      /<meta http-equiv="refresh" content="0;url=(.*?)"/
    );
    const redirectUrl2 = html.match(
      /window\.location\.href\s*=\s*["'](.*?)["']/
    );
    const redirectUrl3 = html.match(
      /window\.location\.replace\s*\(\s*["'](.*?)["']\s*\)/
    );
    if (redirectUrl) {
      sendLog("Redirect URL: " + redirectUrl[1]);
      url = redirectUrl[1];
      html = await soraFetch(url, {
        headers,
      });
      html = html.text ? await html.text() : html;
    } else if (redirectUrl2) {
      sendLog("Redirect URL 2: " + redirectUrl2[1]);
      url = redirectUrl2[1];
      html = await soraFetch(url, {
        headers,
      });
      html = html.text ? await html.text() : html;
    } else if (redirectUrl3) {
      sendLog("Redirect URL 3: " + redirectUrl3[1]);
      url = redirectUrl3[1];
      html = await soraFetch(url, {
        headers,
      });
      html = html.text ? await html.text() : html;
    } else {
      sendLog("No redirect URL found");
    }
  }

  // sendLog("HTML: " + html);
  switch (provider) {
    case "bigwarp":
      try {
        return await bigwarpExtractor(html, url);
      } catch (error) {
        sendLog("Error extracting stream URL from bigwarp:", error);
        return null;
      }
    case "doodstream":
      try {
        return await doodstreamExtractor(html, url);
      } catch (error) {
        sendLog("Error extracting stream URL from doodstream:", error);
        return null;
      }
    case "filemoon":
      try {
        return await filemoonExtractor(html, url);
      } catch (error) {
        sendLog("Error extracting stream URL from filemoon:", error);
        return null;
      }
    case "mp4upload":
      try {
        return await mp4uploadExtractor(html, url);
      } catch (error) {
        sendLog("Error extracting stream URL from mp4upload:", error);
        return null;
      }
    case "vidmoly":
      try {
        return await vidmolyExtractor(html, url);
      } catch (error) {
        sendLog("Error extracting stream URL from vidmoly:", error);
        return null;
      }
    case "vidoza":
      try {
        return await vidozaExtractor(html, url);
      } catch (error) {
        sendLog("Error extracting stream URL from vidoza:", error);
        return null;
      }
    case "voe":
      try {
        return await voeExtractor(html, url);
      } catch (error) {
        sendLog("Error extracting stream URL from voe:", error);
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
  sendLog("BigWarp HD Decoded:", bwDecoded);
  return bwDecoded;
}
/* --- doodstream --- */

/**
 * @name doodstreamExtractor
 * @author Cufiy
 */
async function doodstreamExtractor(html, url = null) {
  sendLog("DoodStream extractor called");
  sendLog("DoodStream extractor URL: " + url);
  const streamDomain = url.match(/https:\/\/(.*?)\//, url)[0].slice(8, -1);
  const md5Path = html.match(/'\/pass_md5\/(.*?)',/, url)[0].slice(11, -2);
  const token = md5Path.substring(md5Path.lastIndexOf("/") + 1);
  const expiryTimestamp = new Date().valueOf();
  const random = randomStr(10);
  const passResponse = await fetch(
    `https://${streamDomain}/pass_md5/${md5Path}`,
    {
      headers: {
        Referer: url,
      },
    }
  );
  sendLog("DoodStream extractor response: " + passResponse.status);
  const responseData = await passResponse.text();
  const videoUrl = `${responseData}${random}?token=${token}&expiry=${expiryTimestamp}`;
  sendLog("DoodStream extractor video URL: " + videoUrl);
  return videoUrl;
}
function randomStr(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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
    sendLog("Iframe URL: " + match[1]);
    const iframeUrl = match[1];
    const iframeResponse = await soraFetch(iframeUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        Referer: url,
      },
    });
    sendLog("Iframe Response: " + iframeResponse.status);
    html = await iframeResponse.text();
  }
  // sendLog("HTML: " + html);
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
  // sendLog("Scripts: " + scripts);
  const evalScript = scripts.find(
    (script) => evalRegex.test(script) && m3u8Regex.test(script)
  );
  if (!evalScript) {
    sendLog("No eval script found");
    return null;
  }
  const unpackedScript = unpack(evalScript);
  // get the m3u8 url
  const m3u8Regex2 = /https?:\/\/[^\s]+master\.m3u8[^\s]*?(\?[^"]*)?/;
  const m3u8Match = unpackedScript.match(m3u8Regex2);
  if (m3u8Match) {
    return m3u8Match[0];
  } else {
    sendLog("No M3U8 URL found");
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
    sendLog("No match found for mp4upload extractor");
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
      sendLog("Vidmoly extractor: No iframe match found");
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
    sendLog("Vidmoly extractor: No match found, using fallback");
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
    sendLog("No match found for vidoza extractor");
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
    sendLog("No application/json script tag found");
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
  // sendLog("Decoded JSON:", result);
  // check if direct_access_url is set, not null and starts with http
  if (result && typeof result === "object") {
    const streamUrl =
      result.direct_access_url ||
      result.source
        .map((source) => source.direct_access_url)
        .find((url) => url && url.startsWith("http"));
    if (streamUrl) {
      sendLog("Voe Stream URL: " + streamUrl);
      return streamUrl;
    } else {
      sendLog("No stream URL found in the decoded JSON");
    }
  }
  return result;
}
function voeRot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26
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
async function soraFetch(
  url,
  options = { headers: {}, method: "GET", body: null }
) {
  try {
    return await fetchv2(
      url,
      options.headers ?? {},
      options.method ?? "GET",
      options.body ?? null
    );
  } catch (e) {
    try {
      return await fetch(url, options);
    } catch (error) {
      await sendLog("soraFetch error: " + error.message);
      return null;
    }
  }
}

class Unbaser {
  constructor(base) {
    this.ALPHABET = {
      62: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      95: "' !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'",
    };
    this.dictionary = {};
    this.base = base;
    if (36 < base && base < 62) {
      this.ALPHABET[base] =
        this.ALPHABET[base] || this.ALPHABET[62].substr(0, base);
    }
    if (2 <= base && base <= 36) {
      this.unbase = (value) => parseInt(value, base);
    } else {
      try {
        [...this.ALPHABET[base]].forEach((cipher, index) => {
          this.dictionary[cipher] = index;
        });
      } catch (er) {
        throw Error("Unsupported base encoding.");
      }
      this.unbase = this._dictunbaser;
    }
  }
  _dictunbaser(value) {
    let ret = 0;
    [...value].reverse().forEach((cipher, index) => {
      ret = ret + Math.pow(this.base, index) * this.dictionary[cipher];
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
  } catch (e) {
    throw Error("Unknown p.a.c.k.e.r. encoding.");
  }
  function lookup(match) {
    const word = match;
    let word2;
    if (radix == 1) {
      word2 = symtab[parseInt(word)];
    } else {
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
        } catch (ValueError) {
          throw Error("Corrupted p.a.c.k.e.r. data.");
        }
      }
    }
    throw Error(
      "Could not make sense of p.a.c.k.e.r data (unexpected code structure)"
    );
  }
  function _replacestrings(source) {
    return source;
  }
}

/* {GE END} */
