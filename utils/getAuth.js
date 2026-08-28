const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function verifyToken(token) {
  const expectedAudience = process.env.API_APP_ID_URI;
  const expectedIssuer = `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0`;

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: expectedAudience, // must match the Application ID URI exposed on the app registration
        issuer: expectedIssuer,
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded); // decoded.oid, decoded.upn, decoded.name available here
      },
    );
  });
}

// Express middleware
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const claims = await verifyToken(authHeader.split(" ")[1]);
    const upn = claims.upn || claims.preferred_username || claims.unique_name;
    req.user = { oid: claims.oid, upn, name: claims.name };
    next();
  } catch (err) {
    console.log("[getAuth] verification failed:", err.name, "-", err.message);
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { requireAuth };
