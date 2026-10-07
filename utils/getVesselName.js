const getVesselName = (siteName) => {
  let result;

  switch (siteName?.toLowerCase()) {
    case "gyreshipdash":
      result = "Gyre";
      break;
    case "proteusshipdash":
      result = "Proteus";
      break;
    case "emmashipdash":
      result = "Emma McCall";
      break;
    case "shipdash":
      result = "Brooks McCall";
      break;
    case "nautshipdash":
      result = "Nautilus";
      break;
    case "shipdash_devenv":
      result = "Dev Env";
      break;
    default:
      result = undefined;
  }

  return result;
};

module.exports = { getVesselName };
