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
}) => {
  if (!listName || !itemColumn || !itemId || !personColumn || !userId) {
    return false;
  }

  const itemLookupField = `${itemColumn}LookupId`;

  try {
    const rows = await getListItems({
      token,
      siteId,
      listName,
      select: [itemLookupField, "EndDate"],
      filter: `fields/${personColumn}LookupId eq ${userId} and fields/EndDate eq null`,
    });

    //stacking 3 filters is probably better, then just ensuring len>=0? something to ponder.
    //additionally maybe at some point i should see if the item is public
    return rows.some(
      (fields) => String(fields[itemLookupField]) === String(itemId),
    );
  } catch (err) {
    console.error("verifyItemAccess error:", err);
    return false;
  }
};

module.exports = { verifyItemAccess };
