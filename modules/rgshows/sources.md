## anime

```js
fetch("https://animeapi.rgshows.me/api/v2/hianime/episode/sources?animeEpisodeId=the-red-ranger-becomes-an-adventurer-in-another-world-19463?ep=131814&server=hd-1&category=dub", {
  "headers": {
    "sec-ch-ua": "\"Chromium\";v=\"136\", \"Google Chrome\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\""
  },
  "referrer": "https://www.rgshows.me/",
  "referrerPolicy": "strict-origin-when-cross-origin",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "omit"
});
```

Simplified:

```js
let title = "the-red-ranger-becomes-an-adventurer-in-another-world-19463";
let episode = "131814";
let server = "hd-1";
let category = "dub";
fetch(`https://animeapi.rgshows.me/api/v2/hianime/episode/sources?animeEpisodeId=${title}?ep=${episode}&server=${server}&category=${category}`, {
  method: "GET",
});
```

## search 

```js
fetch("https://tmdb.rgshows.me/tmdb/3/search/multi?api_key=f6e840332142f77746185ab4e67be858&language=en&include_adult=false&query=bleach", {
  "headers": {
    "accept": "application/json",
    "sec-ch-ua": "\"Chromium\";v=\"136\", \"Google Chrome\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\""
  },
  "referrer": "https://www.rgshows.me/",
  "referrerPolicy": "strict-origin-when-cross-origin",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "omit"
});
```

Simplified:

```js
let title = "bleach";
fetch(`https://tmdb.rgshows.me/tmdb/3/search/multi?api_key=f6e840332142f77746185ab4e67be858&language=en&include_adult=false&query=${title}`, {
  method: "GET",
});
```


## streaming

```js
fetch("https://vidjoy.pro/embed/api/fastfetch/30984/1/1?sr=0", {
  "headers": {
    "accept": "*/*",
    "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"136\", \"Google Chrome\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-fetch-storage-access": "active"
  },
  "referrer": "https://vidjoy.pro/embed/tv/30984/1/1",
  "referrerPolicy": "strict-origin-when-cross-origin",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "omit"
});
```

Simplified:

```js
let id = "30984";
let season = "1";
let episode = "1";
fetch(`https://vidjoy.pro/embed/api/fastfetch/${id}/${season}/${episode}?sr=0`, {
  method: "GET",
});
```

