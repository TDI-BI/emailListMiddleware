const GRAPH = "https://graph.microsoft.com/v1.0";

// Base primitive: fetch a SharePoint list's items via Graph and hand back the `fields` objects.
// `select` narrows the expanded fields ($select inside $expand); `filter` is a raw OData
// $filter string (already using the `fields/...` prefix). Both optional.
const getListItems = async ({ token, siteId, listName, select, filter }) => {
  const selectParam = select?.length ? `($select=${select.join(",")})` : "";
  const filterParam = filter ? `&$filter=${encodeURIComponent(filter)}` : "";

  const response = await fetch(
    `${GRAPH}/sites/${siteId}/lists/${listName}/items?$expand=fields${selectParam}${filterParam}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "HonorNonIndexedQueriesWarningMayFailRandomly",
      },
    },
  );

  const data = await response.json();
  if (!data.value) {
    throw new Error(
      `getListItems(${listName}) failed: ${JSON.stringify(data)}`,
    );
  }
  return data.value.map((item) => item.fields);
};

// Fetches SharePoint list items via Graph, filtered by OR'd fields/{field} eq '{id}' clauses.
// `in` isn't supported on this endpoint (see getMyItems.routes.js history) — this is the OR-chain
// workaround. Caps out around 15 ids before the filter clause / URL length limits kick in.
const getItemsByIds = async ({ token, siteId, listName, ids, field, select }) => {
  if (!ids || ids.length === 0) return [];

  const filter = ids.map((id) => `fields/${field} eq '${id}'`).join(" or ");
  return getListItems({ token, siteId, listName, select, filter });
};

module.exports = { getListItems, getItemsByIds };
