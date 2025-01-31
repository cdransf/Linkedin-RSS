const core = require("@actions/core");
const RSSParser = require("rss-parser");
const https = require("https");

// ---------------------------------------------------------------------------------------------------------------------
// Generic Node.js API to post on LinkedIn
// ---------------------------------------------------------------------------------------------------------------------
const accessToken = core.getInput("ln_access_token");
const feedList = core.getInput("feed_list");
const embedImage = core.getInput("embed_image");

// Get LinkedIn ID, i.e. ownerId
function getLinkedinId(accessToken) {
  return new Promise((resolve, reject) => {
    const hostname = "api.linkedin.com";
    const path = "/v2/me";
    const method = "GET";
    const headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
    };
    const body = "";
    _request(method, hostname, path, headers, body)
      .then((r) => {
        resolve(JSON.parse(r.body).id);
      })
      .catch((e) => reject(e));
  });
}

// Publish content on LinkedIn
function postShare(
  accessToken,
  ownerId,
  title,
  text,
  shareUrl,
  shareThumbnailUrl
) {
  return new Promise((resolve, reject) => {
    const hostname = "api.linkedin.com";
    const path = "/v2/shares";
    const method = "POST";
    const body = {
      owner: "urn:li:person:" + ownerId,
      subject: title,
      text: {
        text, // max 1300 characters
      },
      content: {
        contentEntities: [
          {
            entityLocation: shareUrl,
            thumbnails: [
              {
                resolvedUrl: shareThumbnailUrl,
              },
            ],
          },
        ],
        title,
        "shareMediaCategory": "NONE"
      },
      distribution: {
        linkedInDistributionTarget: {},
      },
    };
    const headers = {
      Authorization: "Bearer " + accessToken,
      "cache-control": "no-cache",
      "Content-Type": "application/json",
      "x-li-format": "json",
      "Content-Length": Buffer.byteLength(JSON.stringify(body)),
    };
    _request(method, hostname, path, headers, JSON.stringify(body))
      .then((r) => {
        resolve(r);
      })
      .catch((e) => reject(e));
  });
}

// Generic HTTP requester
function _request(method, hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const reqOpts = {
      method,
      hostname,
      path,
      headers,
      rejectUnauthorized: false, // WARNING: accepting unauthorised end points for testing ONLY
    };
    let resBody = "";
    const req = https.request(reqOpts, (res) => {
      res.on("data", (data) => {
        resBody += data.toString("utf8");
      });
      res.on("end", () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: resBody,
        });
      });
    });
    req.on("error", (e) => {
      reject(e);
    });
    if (method !== "GET") {
      req.write(body);
    }
    req.end();
  });
}

try {
  const parse = async (url) => {
    const feed = await new RSSParser().parseURL(url);

    console.log(feed.title);
    getLinkedinId(accessToken)
      .then((ownerId) => {
        postShare(
          accessToken,
          ownerId,
          feed.title,
          feed.items[0].title,
          feed.items[0].link,
          embedImage ?? feed.items[0].link
        )
          .then((r) => {
            console.log(r); // status 201 signal successful posting
            if (r.status === 401) {
              core.setFailed(
                "Failed to post on LinkedIn, please check your access token is valid"
              );
            } else if (r.status !== 201) {
              core.setFailed("Failed to post on LinkedIn");
            }
          })
          .catch((e) => console.log(e));
      })
      .catch((e) => console.log(e));
    console.log(
      `${feed.items[0].title} - ${feed.items[0].link}\n${feed.items[0].contentSnippet}\n\n`
    );
  };

  console.log("Parsing " + feedList);

  parse(feedList);
} catch (error) {
  core.setFailed(error.message);
}
