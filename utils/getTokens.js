const axios = require("axios");

//legit just mail lists
const getAccessTokenCmApi = async () => {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: process.env.CM_API_APP_ID,
    client_secret: process.env.CM_API_SECRET_VAL,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await axios.post(tokenUrl, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return res.data.access_token;
};

//creative mode token
const getAccessTokenTdiApi = async () => {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.TDI_API_CLIENT_ID,
    client_secret: process.env.TDI_API_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
};

module.exports = {
  getAccessTokenCmApi,
  getAccessTokenTdiApi,
};
