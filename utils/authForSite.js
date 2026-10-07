// UPNs allowed to submit on behalf of each site, keyed by lowercase siteName
const allowedUpnsBySite = {
  shipdash: ["brooksmccall@tdi-bi.com", "masterbmcc@tdi-bi.com"],
  nautshipdash: ["nautilus@tdi-bi.com", "masternautilus@tdi-bi.com"],
  proteusshipdash: ["proteus@tdi-bi.com", "masterproteus@tdi-bi.com"],
  emmashipdash: ["emmamccall@tdi-bi.com", "masteremma@tdi-bi.com"],
  gyreshipdash: ["gyre@tdi-bi.com", "mastergyre@tdi-bi.com"],
  shipdash_devenv: ["parkerseeley@tdi-bi.com", "no-reply@tdi-bi.com"],
};

const authForSite = (upn, siteName) => {
  const allowed = allowedUpnsBySite[siteName?.toLowerCase()];
  if (!allowed || typeof upn !== "string") return false;

  return allowed.includes(upn.toLowerCase());
};

module.exports = { authForSite };
