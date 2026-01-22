const axios = require('axios');

const getAccessTokenLists = async () => {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: process.env.APP_ID,
    client_secret: process.env.SECRET_VAL,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await axios.post(tokenUrl, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return res.data.access_token;
};

const getAccessToken365 = async () => {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.CLIENTID,
    client_secret: process.env.CLIENTSECRET,
    scope: 'https://graph.microsoft.com/.default',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${process.env.TENANTID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
};

module.exports = {
  getAccessTokenLists,
  getAccessToken365,
};
