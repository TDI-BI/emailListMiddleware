// Helpers for resolving SharePoint site + user identifiers via Graph.
// Kept transport-agnostic: pass in an app access token, get plain values back.

const GRAPH = "https://graph.microsoft.com/v1.0";

// Resolve a site's Graph id from its hostname + server-relative path,
// e.g. getSiteId({ token, hostname: "tdibrooks.sharepoint.com", path: "/sites/informationtechnology" }).
const getSiteId = async ({ token, hostname, path }) => {
  const response = await fetch(`${GRAPH}/sites/${hostname}:${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const data = await response.json();
  if (!data.id) throw new Error(`getSiteId failed: ${JSON.stringify(data)}`);
  return data.id;
};

// Resolve a user's site-specific id — the integer a PersonOrGroup field's LookupId points at.
// It lives in the site's hidden "User Information List": find that list by id, then filter it
// for the user's email. Works for any site given its Graph siteId.
const getSiteUserId = async ({ token, siteId, email }) => {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const listFilter = `displayName eq 'User Information List'`;
  const listResponse = await fetch(
    `${GRAPH}/sites/${siteId}/lists?$filter=${encodeURIComponent(listFilter)}`,
    { headers },
  );
  const listData = await listResponse.json();
  const userInfoListId = listData?.value?.[0]?.id;
  if (!userInfoListId) {
    throw new Error(
      `getSiteUserId: User Information List not found on site ${siteId}`,
    );
  }

  const emailFilter = `fields/EMail eq '${email}'`;
  const userResponse = await fetch(
    `${GRAPH}/sites/${siteId}/lists/${userInfoListId}/items?$expand=fields&$filter=${encodeURIComponent(emailFilter)}`,
    {
      headers: {
        ...headers,
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    },
  );
  const userData = await userResponse.json();
  return userData?.value?.[0]?.id ?? null;
};

module.exports = { getSiteId, getSiteUserId };
