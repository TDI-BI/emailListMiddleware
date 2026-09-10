// Org-chart lookups via Graph's /users endpoints.
// Transport-agnostic like graphSites.js: pass an app access token, get plain values back.
// The app-only token needs User.Read.All on the tdi-api registration.

const GRAPH = "https://graph.microsoft.com/v1.0";

// Emails of the people a user directly manages (one level down).
// `user` is a UPN or object id. Single-page fetch — directReports returns up to 100 and
// nobody here is close; paging (@odata.nextLink) is a later concern.
const getDirectReportEmails = async ({ token, user }) => {
  const response = await fetch(
    `${GRAPH}/users/${encodeURIComponent(user)}/directReports?$select=mail,userPrincipalName`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  const data = await response.json();
  if (!Array.isArray(data.value)) {
    throw new Error(`getDirectReportEmails(${user}) failed: ${JSON.stringify(data)}`);
  }

  return data.value
    // directReports can technically include groups — keep only users, and fall back to
    // the UPN when a mailbox-less account has no `mail`.
    .filter((o) => o["@odata.type"] !== "#microsoft.graph.group")
    .map((u) => u.mail || u.userPrincipalName)
    .filter(Boolean);
};

module.exports = { getDirectReportEmails };
