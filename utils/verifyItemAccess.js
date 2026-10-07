const { getListItems } = require("./getItemsByIds");

// Secondary auth: confirm a SharePoint user is the actively-assigned owner of a specific item,
// via a join list (e.g. AssetAssignment).
//
//   verifyItemAccess({
//     token, siteId,
//     listName: "AssetAssignment",   // the join list
//     itemColumn: "Asset",            // lookup column on the join list pointing at the item
//     itemId,                         // the item id the caller wants data for
//     personColumn: "Person",         // PersonOrGroup column on the join list
//     userId,                         // internal site user id (from getSiteUserId)
//     publicWhen: {                    // optional: skip the ownership check entirely when the
//       list: "Asset",                //   target item itself is flagged public
//       field: "ClassificationLevel",
//       value: "Public",
//     },
//   })
//
// Active = the row's EndDate is null. We filter server-side on the person LookupId (queryable)
// and match the item LookupId in JS, since Graph 400s on $filter against most lookup-id columns.
// Fails closed: anything unexpected returns false.
const verifyItemAccess = async ({
  token,
  siteId,
  listName,
  itemColumn,
  itemId,
  personColumn,
  userId,
  publicWhen,
}) => {
  if (!itemId) return false;

  try {
    // Public items are unprotected — no assignment required.
    if (publicWhen?.list && publicWhen?.field) {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${publicWhen.list}/items/${itemId}?$expand=fields($select=${publicWhen.field})`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (response.ok) {
        const data = await response.json();
        if (data?.fields?.[publicWhen.field] === publicWhen.value) return true;
      }
    }

    if (!listName || !itemColumn || !personColumn || !userId) return false;

    const itemLookupField = `${itemColumn}LookupId`;
    const rows = await getListItems({
      token,
      siteId,
      listName,
      select: [itemLookupField, "EndDate"],
      filter: `fields/${personColumn}LookupId eq ${userId} and fields/EndDate eq null`,
    });

    return rows.some(
      (fields) => String(fields[itemLookupField]) === String(itemId),
    );
  } catch (err) {
    console.error("verifyItemAccess error:", err);
    return false;
  }
};

module.exports = { verifyItemAccess };
