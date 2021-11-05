const serverless = require("serverless-http");
const path = require("path");
const express = require("express");
const { Provider } = require("oidc-provider");
const bodyParser = require("body-parser");
// const multer = require("multer");
const expressSanitizer = require("express-sanitizer");
const db = require("./db");
const AWS = require("aws-sdk");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
  // DeleteSecretCommand,
} = require("@aws-sdk/client-secrets-manager");

// PARA ACCEDER AL AWS-SDK
const accessKeyId = process.env.AWS_ACCESS_KEY || "AKIAU4IW7DXLHO6WKUAK";
const secretAccessKey =
  process.env.AWS_SECRET_KEY || "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";

const s3 = new AWS.S3({
  accessKeyId: accessKeyId,
  secretAccessKey: secretAccessKey,
});

const secretsClient = new SecretsManagerClient({ region: "us-east-2" });

const expressApp = express();

expressApp.set("trust proxy", false);
expressApp.set("view engine", "ejs");
expressApp.set("views", path.resolve(__dirname, "views"));

const parse = bodyParser.urlencoded({ extended: false });

function setNoCache(req, res, next) {
  res.set("Pragma", "no-cache");
  res.set("Cache-Control", "no-cache, no-store");
  next();
}

expressApp.get("/interaction/:uid", setNoCache, async (req, res, next) => {
  try {
    const details = await oidc.interactionDetails(req, res);
    const { uid, prompt, params } = details;

    console.log(`PARAMS`);
    console.log(req);
    console.log(uid, prompt, params);
    console.log(`END PARAMS`);
    return;
    // console.log(req);

    // ------------------------------------
    const { redirect_uri, client_id, response_type, scope } = req.query;
    console.log(redirect_uri, client_id, response_type, scope);
    // console.log(req);
    console.log(req.query);
    return;
    // console.log(req.headers.referer);

    const sql = `SELECT oidc_entity_name, clientID_ARN, secretID_ARN, redirectURIS
                  FROM oidc_idp oi
                    LEFT JOIN oidc_sp os<
                    ON oi.oidc_sp_id = os.id`;

    const [rows] = await db.query(sql);

    if (Object.keys(rows[0]).length === 0) {
      res.status(401).send({
        msg: "Entidad Inexistente",
      });
    }

    let arrARNs = [];
    rows[0].forEach((row) => {
      if (row.redirectURIS.indexOf(redirect_uri) > -1) {
        console.log(`CONTIENE LA URL`);
        arrARNs.push({
          clientID_ARN: row.clientID_ARN,
          secretID_ARN: row.secretID_ARN,
        });
      }
    });

    let openid_conection = false;
    let secretID_ARN = "";

    arrARNs.forEach(async (data) => {
      let clientID_secret;

      clientID_secret = await secretsClient.send(
        new GetSecretValueCommand({
          SecretId: data.clientID_ARN,
        })
      );

      let CLIENTID_SECRET_VALUE;
      if ("SecretString" in clientID_secret) {
        CLIENTID_SECRET_VALUE = clientID_secret.SecretString;
      } else {
        // Create a buffer
        const buff = new Buffer(clientID_secret.SecretBinary, "base64");
        CLIENTID_SECRET_VALUE = buff.toString("ascii");
      }

      if (CLIENTID_SECRET_VALUE == client_id) {
        openid_conection = true;
        secretID_ARN = data.secretID_ARN;
      }
    });

    if (!openid_conection) {
      res.status(401).send({
        msg: "Error de conexión: Cliente Invalido",
      });
    }

    if (secretID_ARN) {
      let secretID_secret_str;

      secretID_secret_str = await secretsClient.send(
        new GetSecretValueCommand({
          SecretId: secretID_ARN,
        })
      );

      let SECRETID_SECRET_VALUE;
      if ("SecretString" in secretID_secret_str) {
        SECRETID_SECRET_VALUE = secretID_secret_str.SecretString;
      } else {
        // Create a buffer
        const buff = new Buffer(secretID_secret_str.SecretBinary, "base64");
        SECRETID_SECRET_VALUE = buff.toString("ascii");
      }
    }

    // AQUI VOY
    for (let i = 0; i <= redirect_uri.length; i++) {
      if (redirect_uri.charAt(i) == ",") commaCounter++;
    }

    const oidcConf = {
      clients: [
        {
          client_id: client_id,
          client_secret: SECRETID_SECRET_VALUE,

          // grant_types: ['refresh_token', 'authorization_code'],
          // grant_types can only contain 'implicit', 'authorization_code', or 'refresh_token'
          grant_types: ["implicit"],
          response_types: ["id_token"],
          redirect_uris: [
            "https://my.local.host:4200/home",
            "https://my.local.host:4200",
          ], // SP URL DE REDIRECCIÓN
          token_endpoint_auth_method: "none",
        },
      ],
      features: {
        devInteractions: { enabled: false },
      },
      // httpOptions: 'https://my.local.host:4200/home',
      // claims: {
      //     email: ['email', 'email_verified'],
      //     // phone: ['phone_number', 'phone_number_verified'],
      //     // profile: ['birthdate', 'family_name', 'gender', 'given_name', 'locale', 'middle_name', 'name', 'nickname',
      //     //  'picture', 'preferred_username', 'profile', 'updated_at', 'website', 'zoneinfo']
      // },
      // cookies: {
      //     long: {
      //         httpOnly: true,
      //         overwrite: true,
      //         sameSite: 'none'
      //     },
      //     short: {
      //         httpOnly: true,
      //         overwrite: true,
      //         sameSite: 'lax'
      //     }
      // },
      // discovery: {
      //     claim_types_supported: [
      //         'normal'
      //     ],
      //     claims_locales_supported: undefined,
      //     display_values_supported: undefined,
      //     op_policy_uri: undefined,
      //     op_tos_uri: undefined,
      //     service_documentation: undefined,
      //     ui_locales_supported: undefined
      // }
      // async findById(ctx, id) {
      //     return {
      //         accountId: id,
      //         async claims() { return { sub: id }; },
      //     };
      // }
    };

    const oidc = new Provider("http://localhost:3000/oidc", oidcConf); // IDP
    oidc.proxy = true; // https con ssl y no localhost
    oidc.app;

    oidc.callback();
    // ------------------------------------

    const client = await oidc.Client.find(params.client_id);

    if (prompt.name === "login") {
      return res.render("loginSoyyo", {
        client,
        uid,
        details: prompt.details,
        params,
        title: "Sign-in",
        flash: undefined,
      });
    }

    return res.render("interaction", {
      client, // login
      uid,
      details: prompt.details,
      params,
      title: "Authorize",
    });
  } catch (err) {
    return next(err);
  }
});

// AQUI SE DEBE VALIDAR LA EXISTENCIA DEL USUARIO SOYYO
expressApp.post(
  "/interaction/:uid/login",
  setNoCache,
  parse,
  async (req, res, next) => {
    try {
      const { uid, prompt, params } = await oidc.interactionDetails(req, res);
      // console.log(`LOGIN OPENID PARAMS`);
      // console.log(uid, prompt, params);
      // console.log(`END LOGIN OPENID PARAMS`);

      // assert.strictEqual(prompt.name, 'login');
      // const client = await oidc.Client.find(params.client_id);

      // const accountId = await Account.authenticate(req.body.email, req.body.password);

      // if (!accountId) {
      //     res.render('login', {
      //         client,
      //         uid,
      //         details: prompt.details,
      //         params: {
      //             ...params,
      //             login_hint: req.body.email,
      //         },
      //         title: 'Sign-in',
      //         flash: 'Invalid email or password.',
      //     });
      //     return;
      // }

      // const result = {
      //     login: { accountId },
      // };

      const result = {
        login: { accountId: 1 },
      };

      await oidc.interactionFinished(req, res, result, {
        mergeWithLastSubmission: false,
      });
    } catch (err) {
      next(err);
    }
  }
);

expressApp.post(
  "/interaction/:uid/confirm",
  setNoCache,
  parse,
  async (req, res, next) => {
    try {
      const interactionDetails = await oidc.interactionDetails(req, res);
      const {
        prompt: { name, details },
        params,
        session: { accountId },
      } = interactionDetails;
      assert.strictEqual(name, "consent");

      let { grantId } = interactionDetails;
      let grant;

      if (grantId) {
        // we'll be modifying existing grant in existing session
        grant = await oidc.Grant.find(grantId);
      } else {
        // we're establishing a new grant
        grant = new oidc.Grant({
          accountId,
          clientId: params.client_id,
        });
      }

      if (details.missingOIDCScope) {
        grant.addOIDCScope(details.missingOIDCScope.join(" "));
        // use grant.rejectOIDCScope to reject a subset or the whole thing
      }
      if (details.missingOIDCClaims) {
        grant.addOIDCClaims(details.missingOIDCClaims);
        // use grant.rejectOIDCClaims to reject a subset or the whole thing
      }
      if (details.missingResourceScopes) {
        // eslint-disable-next-line no-restricted-syntax
        for (const [indicator, scopes] of Object.entries(
          details.missingResourceScopes
        )) {
          grant.addResourceScope(indicator, scopes.join(" "));
          // use grant.rejectResourceScope to reject a subset or the whole thing
        }
      }

      grantId = await grant.save();

      const consent = {};
      if (!interactionDetails.grantId) {
        // we don't have to pass grantId to consent, we're just modifying existing one
        consent.grantId = grantId;
      }

      const result = { consent };
      await oidc.interactionFinished(req, res, result, {
        mergeWithLastSubmission: true,
      });
    } catch (err) {
      next(err);
    }
  }
);

expressApp.get(
  "/interaction/:uid/abort",
  setNoCache,
  async (req, res, next) => {
    try {
      const result = {
        error: "access_denied",
        error_description: "End-User aborted interaction",
      };
      await oidc.interactionFinished(req, res, result, {
        mergeWithLastSubmission: false,
      });
    } catch (err) {
      next(err);
    }
  }
);

expressApp.get("/oscar", async (req, res) => {
  res.send("Hello oscar!");
});

expressApp.get("/oscartest", async (req, res) => {
  res.json({ msg: "Hello oscar!" });
});

async function getArrClients() {
  try {
    const sqloidcentities = `SELECT * FROM oidc_idp oi
                                    LEFT JOIN oidc_sp os
                                        ON oi.oidc_sp_id = os.id;`;

    const [rows] = await db
      .query(sqloidcentities)
      .catch((err) => console.log(err));

    if (Object.keys(rows[0]).length === 0) {
      res.status(401).send({
        msg: "Sin entidades",
      });
    }

    let arrClients = [];

    let clientID_secret, secretID_secret;

    for (let i = 0; i < rows.length; i++) {
      clientID_secret = await secretsClient
        .send(
          new GetSecretValueCommand({
            SecretId: rows[i].clientID_ARN,
          })
        )
        .catch((err) => console.log(err));

      secretID_secret = await secretsClient
        .send(
          new GetSecretValueCommand({
            SecretId: rows[i].secretID_ARN,
          })
        )
        .catch((err) => console.log(err));

      let CLIENTID_SECRET_VALUE, SECRETID_SECRET_VALUE;

      if ("SecretString" in clientID_secret) {
        CLIENTID_SECRET_VALUE = clientID_secret.SecretString;
      } else {
        // Create a buffer
        const buff = new Buffer(clientID_secret.SecretBinary, "base64");
        CLIENTID_SECRET_VALUE = buff.toString("ascii");
      }

      if ("SecretString" in secretID_secret) {
        SECRETID_SECRET_VALUE = secretID_secret.SecretString;
      } else {
        // Create a buffer
        const buff = new Buffer(secretID_secret.SecretBinary, "base64");
        SECRETID_SECRET_VALUE = buff.toString("ascii");
      }

      arrClients.push({
        client_id: CLIENTID_SECRET_VALUE,
        client_secret: SECRETID_SECRET_VALUE,
        grant_types: ["implicit"],
        response_types: ["id_token"],
        redirect_uris: rows[i].redirectURIS.split(","), // SP URL DE REDIRECCIÓN
        token_endpoint_auth_method: "none",
      });
    }

    return arrClients;
  } catch (err) {
    console.log(err);
  }
}

console.info("start ovargas serverless :D");
// module.exports.handler = serverless(expressApp);

// (async () => {
//   const arrClients = await getArrClients();
//   // console.log(arrClients);

//   const oidcConf = {
//     clients: arrClients,
//   };

//   const oidc = new Provider(
//     "https://wz0zc39gq2.execute-api.us-east-1.amazonaws.com/dev/oidc",
//     oidcConf
//   ); // IDP

//   expressApp.use("/oidc", oidc.callback());
//   oidc.proxy = true; // https con ssl y no localhost
//   oidc.app;

//   // const server = await serverless(expressApp);
//   // const { port } = server.address();
//   // console.info(`Server listening on port ${port}`);

//   module.exports.handler = serverless(expressApp);
// })();

// module.exports.handler = async (event, context) => {
//   const arrClients = await getArrClients();
//   // console.log(arrClients);

//   const oidcConf = {
//     clients: arrClients,
//   };

//   const oidc = new Provider(
//     "https://wz0zc39gq2.execute-api.us-east-1.amazonaws.com/dev/oidc",
//     oidcConf
//   ); // IDP

//   expressApp.use("/oidc", oidc.callback());
//   oidc.proxy = true; // https con ssl y no localhost
//   oidc.app;

//   // return serverless(expressApp);
// };

// expressApp.use("/oidc", async (req, res) => {
//   const arrClients = await getArrClients();

//   const oidcConf = {
//     clients: arrClients,
//   };

//   const oidc = new Provider(
//     "https://wz0zc39gq2.execute-api.us-east-1.amazonaws.com/dev/oidc",
//     oidcConf
//   );

//   oidc.proxy = true; // https con ssl y no localhost
//   oidc.app;

//   return oidc.callback();
// });

// TEST
const oidcConf = {
  clients: [
    {
      client_id: "foo",
      client_secret: "foo",
      grant_types: ["implicit"],
      response_types: ["id_token"],
      redirect_uris: "https://my.local.host:4200/home",
      token_endpoint_auth_method: "none",
    },
  ],
};

const oidc = new Provider(
  // "https://wz0zc39gq2.execute-api.us-east-1.amazonaws.com/dev/oidc",
  "http://localhost:3000/dev/oidc",
  oidcConf
);

oidc.proxy = false; // https con ssl y no localhost
// oidc.app;

expressApp.use("/oidc", oidc.callback());

module.exports.handler = serverless(expressApp);
