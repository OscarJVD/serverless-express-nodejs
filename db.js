const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "idp-bd.cogpuyzsocmi.us-east-2.rds.amazonaws.com",
  user: "admin",
  password: "rRGpdFVbFcnsnjNJiH90",
  database: "idpsoyyotest",
});

module.exports = pool.promise();
