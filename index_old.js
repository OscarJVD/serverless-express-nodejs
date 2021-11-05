const serverless = require("serverless-http");
const express = require("express");
const app = express();

app.get("/", function (req, res) {
  res.send("Hello World!");
});

app.get("/oscar", function (req, res) {
  res.json({ msg: "Hello World!" });
});

module.exports.handler = serverless(app);
