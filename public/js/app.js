// run some basic setup on page load
$(document).ready( function() {
  $("#query-text").bind("enterKey", submitQuery);

  $("#query-text").keyup( function(e) {
    if(e.keyCode == 13) {
      $(this).trigger("enterKey");
    }
  });

  if($("#selected-user").length) {
    fetchUsers();
  }
});

// submits a query to ES based on data from the web page (if needed)
function submitQuery() {
  if(typeof(generateEsQuery) != "function") {
    console.error("generateEsQuery() not implemented for this page. Not executing query.");
    return
  }

  queryString = $("#query-text").val()
  selectedUser = $("#selected-user").val()

  if(!queryString) {
    queryString = "*";
  }

  esQuery = JSON.stringify(generateEsQuery(queryString, selectedUser))

  $.post("http://localhost:9200/tweets/_search", esQuery, function(data, status) {
    hits = data['hits']['hits']
    console.log(hits)
    $("#search-results").empty();

    for(key in hits) {
      hit = hits[key]['fields'] || hits[key]['_source']
      console.log(hit);

      resultRow = renderHit(hit)
      $("#search-results").append(resultRow);
    }
  });
}

// generates HTML for a single row in the search results
function renderHit(hit) {
  profilePicUrl = hit['user']['profile_image_url'] || "" // drop the profile pic for the warmup exercise
  userName      = hit['user']['name']
  handle        = hit['user']['screen_name']
  date          = new Date(hit['created_at'])
  tweetText     = hit['text']
  entities      = hit['entities']

  var dateOptions = {
    weekday: "short", year: "numeric", month: "short",
    day: "numeric", hour: "2-digit", minute: "2-digit"
  };

  dateString = date.toLocaleTimeString("en-us", dateOptions);

  innerHtml = `
    <tr class='tweet'>
      <td>
        <img src='${profilePicUrl}' class='profilePic'>
      </td>
      <td class='userName'>
        ${userName}<br>
        <a href='https://twitter.com/${handle}' target='_blank'>@${handle}</a>
      </td>
      <td class='tweetText'>
        ${renderTweetText(tweetText, entities)}
      </td>
      <td>
        ${dateString}
      </td>
    </tr>
  `
  return innerHtml;
}

// enriches the tweet text by inserting html anchors for all entities in the tweet
function renderTweetText(text, entities) {
  mappedEntities = mapEntities(entities);
  sortedEntities = mappedEntities.sort( function(e1, e2) {
    return e2[1] - e1[1]; // need to reverse sort by index for the link insert to work properly
  });

  innerHtml = sortedEntities.reduce( function(tempText, urlData) {
    return insertUrl.apply(null, [tempText].concat(urlData));
  }, text);

  return innerHtml;
}

// maps entities to urls & indices
function mapEntities(entities) {
  // hashtags
  hashtags = entities['hashtags'].map( function(entity) {
    tag = entity['text']
    url = `https://twitter.com/hashtag/${tag}`

    return [url].concat(entity['indices'])
  });

  // user mentions
  user_mentions = entities['user_mentions'].map( function(entity) {
    handle = entity['screen_name']
    url = `https://twitter.com/${handle}`

    return [url].concat(entity['indices'])
  });

  // urls
  urls = entities['urls'].map( function(entity) {
    url = entity['url']

    return [url].concat(entity['indices'])
  });

  flattenedEntities = [hashtags].concat(user_mentions, urls);

  return flattenedEntities.filter(function(arr){ return arr.length > 0 });
}

// inserts an html anchor into a string
function insertUrl(string, url, start, end) {
  return string.slice(0, start) + `<a href="${url}">` + string.slice(start, end) + "</a>" + string.slice(end, string.length);
}

// populates the #selected-user drop-down with all usernames in ES
function fetchUsers() {
  query = {
    "aggs" : {
      "bucket_by_user" : {
        "terms" : {
          "field" : "user.screen_name",
          "size": 0
        }
      }
    },
    "size": 0
  }

  queryData = JSON.stringify(query)

  $.post("http://localhost:9200/tweets/_search", queryData, function(data, status) {
    console.log(data);

    users = data['aggregations']['bucket_by_user']['buckets'].map( function(user) {
      return user['key'];
    });

    users.forEach( function(user) {
      $("#selected-user").append(`<option value="${user}">${user}</option>`);
    });
  });
}
