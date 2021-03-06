// Creating API for user authentication and multipart file upload

"use strict";

// Load client parameters from ENV file
require("dotenv").config();

var fs = require("fs"),
    multer = require("multer"),
    request = require("request"),
    express = require("express"),
    router = express.Router();

// Google OAuth client id, secret and redirect uri configured from .env
const _CLIENT_ID = process.env.CLIENTID,
    _CLIENT_SECRET = process.env.CLIENTSECRET,
    _REDIRECT_URL = process.env.REDIRECTURL;

var access_token = "";

var oauthUrl = getOAuthURL();

// "Multer" is used for multi-part file uploading
var upload = multer({
    dest: "uploads/"
}).single("image");

/**
 * generate OAuthUrl
 *
 * @returns
 */
function getOAuthURL() {
    // authorization uri
    var authUrl = "https://accounts.google.com/o/oauth2/v2/auth?";

    // access_type
    var access_type = "access_type=offline&";
    // scopes
    var scope =
        "scope=" +
        encodeURIComponent(
            "https://www.googleapis.com/auth/drive.file" +
                " " +
                "https://www.googleapis.com/auth/drive.metadata.readonly" +
                " " +
                "https://www.googleapis.com/auth/plus.me"
        ) +
        "&";
    // response type
    var response_type = "response_type=code&";
    // client id
    var client_id = "client_id=" + _CLIENT_ID + "&";
    // redirect uri
    var redirect_uri = "redirect_uri=" + encodeURIComponent(_REDIRECT_URL);

    //#endregion

    // prepare url and return
    var _oauthUrl = authUrl + access_type + scope + response_type + client_id + redirect_uri;
    console.info(["drive.api.js" + " : The OAuth URL is " + _oauthUrl]);
    return _oauthUrl;
}

/**
 * return oauthurl
 */
router.get(
    "/auth",
    (req, res) => {
        console.info(["drive.api.js" + " : router.get1"]);
        res.json({ url: oauthUrl });
    },
    (err) => {
        console.error(err);
        res.send(500);
    }
);

/**
 * oauth callback
 */
router.use("/auth/oauthcallback", (req, res) => {

    console.info(["drive.api.js" + " : router.use"]);

    var session = req.session;
    var code = req.query.code;

    // retrieve access_token by sending authorization code
    var url = "https://www.googleapis.com/oauth2/v4/token";
    request(
        {
            uri: url,
            method: "POST",
            form: {
                code: code,
                client_id: _CLIENT_ID,
                client_secret: _CLIENT_SECRET,
                grant_type: "authorization_code",
                redirect_uri: _REDIRECT_URL
            },
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        },
        (err, response, body) => {
            if (err) {
                return console.error(err);
            }

            // set the access_token
            var json = JSON.parse(body);
            access_token = json.access_token;
            session["tokens"] = body;

            // redirect to home page for upload
            res.redirect("/home");
        }
    );
});

// UPLOAD IMAGE
router.post("/upload", upload, (req, res) => {
    var file = req.file;

    // Construct the upload request based on the Google Drive v3
    var url = "https://www.googleapis.com/upload/drive/v3/files";

    request(
        {
            uri: url,
            qs: {
                uploadType: "multipart"
            },
            method: "POST",
            headers: {
                "Content-Type": "multipart/related",
                Authorization: "Bearer " + access_token
            },
            multipart: [
                {
                    "Content-Type": "application/json; charset=UTF-8",
                    body: JSON.stringify({
                        name: file.originalname
                    })
                },
                {
                    "Content-Type": file.mimetype,
                    body: fs.createReadStream(file.path)
                }
            ]
        },
        (error, response, body) => {
            if (error) {
                console.info(["drive.api.js" + " : router.post.1 -> Error"]);
                console.error(error);
                console.info();
                res.sendStatus(500);
            }

            fs.unlink(file.path);
            res.sendStatus(200);
        }
    );
});

router.get("/user", (req, res) => {
    if (req.session["tokens"]) {
        res.send(200);
    } else {
        res.send(500);
    }
});

module.exports = router;
