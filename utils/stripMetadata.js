// SharePoint list items come back padded with system columns. This drops them so callers are
// left with just the list's custom fields. Everything starting with "_" or "@" is SharePoint
// internal (compliance flags, odata annotations, version strings); the rest is a fixed denylist
// of the always-present item metadata.
const SYSTEM_FIELDS = new Set([
  "id",
  "ContentType",
  "Attachments",
  "Edit",
  "AuthorLookupId",
  "EditorLookupId",
  "FolderChildCount",
  "ItemChildCount",
  "Created",
  "Modified",
]);

const stripMetadata = (fields) => {
  if (!fields) return fields;
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([key]) =>
        !SYSTEM_FIELDS.has(key) && !key.startsWith("_") && !key.startsWith("@"),
    ),
  );
};

module.exports = { stripMetadata };
