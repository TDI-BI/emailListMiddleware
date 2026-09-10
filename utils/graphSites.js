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

// OData string literals escape a single quote by doubling it.
const odataString = (value) => `'${String(value).replace(/'/g, "''")}'`;

// The site's hidden "User Information List" holds the mapping between people and the integer
// ids that PersonOrGroup LookupId fields point at. Resolve that list's id once per site.
const getUserInfoListId = async ({ token, siteId }) => {
  const listFilter = `displayName eq 'User Information List'`;
  const listResponse = await fetch(
    `${GRAPH}/sites/${siteId}/lists?$filter=${encodeURIComponent(listFilter)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  const listData = await listResponse.json();
  const userInfoListId = listData?.value?.[0]?.id;
  if (!userInfoListId) {
    throw new Error(
      `getUserInfoListId: User Information List not found on site ${siteId}`,
    );
  }
  return userInfoListId;
};

// Resolve a user's site-specific id — the integer a PersonOrGroup field's LookupId points at —
// by filtering the User Information List for the user's email. Works for any site given its siteId.
const getSiteUserId = async ({ token, siteId, email }) => {
  const [{ id }] = await getSiteUserIds({ token, siteId, emails: [email] });
  return id;
};

// Batch version of getSiteUserId: one OR-filtered request against the User Information List for
// a list of emails. Returns [{ email, id }] preserving the input order; id is null for any email
// with no matching site user. Keep the batch small (~15) — same OData filter-length ceiling as
// getItemsByIds. Match is case-insensitive on email since SharePoint stores EMail inconsistently.
const getSiteUserIds = async ({ token, siteId, emails }) => {
  const wanted = [...new Set(emails.filter(Boolean))];
  if (wanted.length === 0) return [];

  const userInfoListId = await getUserInfoListId({ token, siteId });

  const filter = wanted
    .map((email) => `fields/EMail eq ${odataString(email)}`)
    .join(" or ");
  const userResponse = await fetch(
    `${GRAPH}/sites/${siteId}/lists/${userInfoListId}/items?$select=id&$expand=fields($select=EMail)&$filter=${encodeURIComponent(filter)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    },
  );
  const userData = await userResponse.json();
  if (!Array.isArray(userData.value)) {
    throw new Error(`getSiteUserIds failed: ${JSON.stringify(userData)}`);
  }

  const idByEmail = new Map(
    userData.value
      .filter((item) => item.fields?.EMail)
      .map((item) => [item.fields.EMail.toLowerCase(), item.id]),
  );

  return wanted.map((email) => ({
    email,
    id: idByEmail.get(email.toLowerCase()) ?? null,
  }));
};

module.exports = { getSiteId, getSiteUserId, getSiteUserIds };
