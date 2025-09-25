async function searchResults(keyword) {
  try {
    // this is the original api, but it requires an api key, so i used my own api
    // const response = await fetch(`https://api.themoviedb.org/3/search/multi?query=${keyword}&include_adult=false&language=en-US&page=1&sort_by=popularity.desc`, {
    //     headers: {
    //         'Authorization': 'your token here',
    //         'accept': 'application/json'
    //     }
    // });

    // this is my own api, it may be a pit slow, as it fetches data from tmdb, but i dont want to share the api key
    const response = await fetch(
      `https://api.jm26.net/sora-modules/tmdb-api/?type=search&query=${keyword}&page=1`
    );
    let data = JSON.parse(response);

    // if there is a results array, use it, otherwise use the data object
    data = data.results || data;
	

    const transformedResults = data.map((result) => {
  const id = result.media_type === 'tv' ? `s-${result.id}` : `m-${result.id}`;
  return {
    title: result.title || result.name,
    image: "https://image.tmdb.org/t/p/w500" + result.poster_path,
    href: `https://www.rgshows.me/?p=1&m=${id}`,
  };
});

    return JSON.stringify(transformedResults);
  } catch (error) {
    console.log("Fetch error:", error);
    return JSON.stringify([{ title: "Error", image: "", href: "" }]);
  }
}

async function extractDetails(url) {
  console.log("extractDetails:" + url);
  // return JSON.stringify([{
  //     description: 'IMPLEMENT DESCRIPTION FUNCTION',
  //     aliases: '---',
  //     airdate: '---'
  //     }]);

  try {
    // get id from url ?m= , e.g. m=s-30984 or m=m-157336
    // Use a regex to extract the 'm' parameter instead of URL constructor
    const mMatch = url.match(/[?&]m=([^&]*)/);
    const id = mMatch ? mMatch[1] : null;
    console.log("id:", id);
    const response = await fetch(
      `https://api.jm26.net/sora-modules/tmdb-api/?id=${id}`
    );
    const data = JSON.parse(response);
    console.log("Description data:", data);
    let aired = "";
    if (data.release_date) {
      aired = data.release_date.split("-").slice(0, 1);
    } else if (data.first_air_date) {
      aired =
        data.first_air_date.split("-").slice(0, 1).join(".") +
        " - " +
        data.last_air_date.split("-").slice(0, 1).join(".");
    }
    let aliases = "";
    if (data.runtime) {
      aliases = "Duration: " + data.runtime + " min";
    } else if (data.original_name) {
      aliases = "Original Name: " + data.original_name;
    }

    const transformedResults = [
      {
        description: data.overview,
        aliases,
        airdate: "Aired: " + aired,
      },
    ];

    return JSON.stringify(transformedResults);
  } catch (error) {
    console.log("Details error:" + error);
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
    // Use a regex to extract the 'm' parameter instead of URL constructor
    const mMatch = url.match(/[?&]m=([^&]*)/);
    const id = mMatch ? mMatch[1] : null;
    console.log("id:", id);
    const response = await fetch(
      `https://api.jm26.net/sora-modules/tmdb-api/?id=${id}`
    );
    const data = JSON.parse(response);
    // console.log("Episodes data:", data);

    // if seasons is in the data, its a tv show, otherwise its a movie
    let transformedResults = [];
    if (!data.seasons) {
        transformedResults = [
            {
            href: url,
            number: 0
        }];
    } else {
        // list the episodes of all seasons. the episodes are in the episodes array of each season. the number should start from 0 and increase by 1 for each episode
       /* example json
        "seasons": [
        {
            "air_date": "2008-02-06",
            "episode_count": 3,
            "id": 43372,
            "name": "Specials",
            "overview": "Collection of Naruto shorts.",
            "poster_path": "/pIj5B3Y1rPtSVD1X8yuaGntEm3l.jpg",
            "season_number": 0,
            "vote_average": 0.0
        },
        {
            "air_date": "2007-02-13",
            "episode_count": 32,
            "id": 43373,
            "name": "Kazekage Rescue",
            "overview": "Naruto Uzumaki is back! After two and a half years of training on the road with Jiraiya of the Sannin, Naruto is back in the Village Hidden in the Leaves and he's ready to show off his new skills. He and Sakura team up to take on their old master Kakashi, who's pretty impressed with their progress. They'll have plenty of opportunity to put it into action when news arrives from the Sand Village that Gaara, Naruto's former rival and now Kazekage of the Sand, has been kidnapped! And the culprits are the very same group who are after Naruto - the Akatsuki!",
            "poster_path": "/842myobV2MkoHZuoyxJDV9gdkvb.jpg",
            "season_number": 1,
            "vote_average": 7.9
        },
        ...
        */
        let episodeNumber = 1;
        for (let i = 0; i < data.seasons.length; i++) {
            const season = data.seasons[i];
            for (let j = 0; j < season.episode_count; j++) {
                transformedResults.push({
                    href: `https://www.rgshows.me/?p=1&m=${id}&season=${season.season_number + 1}&episode=${j + 1}`,
                    number: episodeNumber++
                });
            }
        }
    }

    return JSON.stringify(transformedResults);
  } catch (error) {
    console.log("Fetch error:" + error);
    return JSON.stringify([{ href: "", number: "Error" }]);
  }
}

async function extractStreamUrl(url) {
  let errorVids = {
    "extractNullUrl": "https://files.catbox.moe/add3ya.mp4",
    "totalFetchError": "https://files.catbox.moe/jn0x50.mp4"
  }

  try {
    console.log("extractStreamUrl:" + url);
    // get id from url ?m= , e.g. m=s-30984 or m=m-157336
    // Use a regex to extract the 'm' parameter instead of URL constructor
    const mMatch = url.match(/[?&]m=([^&]*)/);
    let rawId = mMatch ? mMatch[1] : null;
    // remove the first two characters from the id, e.g. s-30984 -> 30984
    id = rawId.substring(2);
    console.log("id: " + id);

  //   curl 'https://api.rgshows.me/main/movie/157336' \
  // -H 'origin: https://www.rgshows.me' \
  // -H 'referer: https://www.rgshows.me/' \
    
    const headers = {
      "origin": "www.rgshows.me",
      "referer": "https://www.rgshows.me/",
    }
    const response = await fetchv2(
      `https://api.rgshows.me/main/movie/${id}`,
      headers
    );
    const data = JSON.parse(response);
    console.log("Stream data:" + JSON.stringify(data));
    let result = errorVids['extractNullUrl'];
    if (data['stream']['url']) {
      result = data['stream']['url'];
    }
   

    return JSON.stringify(result);
  } catch (error) {
    console.log("Fetch error:" + error);
    return errorVids['totalFetchError'];
  }
}