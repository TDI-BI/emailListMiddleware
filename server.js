const express = require("express");
require("dotenv").config();

const app = express();

// CORS only in dev
if (process.env.PROD !== "true") {
  const cors = require("cors");
  app.use(cors());
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Silence favicon spam
app.get("/favicon.ico", (req, res) => res.status(204).end());

// HOME / HEALTH ROUTES
app.use("/", require("./routes/home.routes"));

// GROUP / GRAPH ROUTES
app.use("/", require("./routes/getAll.routes"));
app.use("/", require("./routes/getGroupById.routes"));
app.use("/", require("./routes/getGroupByName.routes"));
app.use("/", require("./routes/getSelectedGroups.routes"));

// SHAREPOINT ROUTES
app.use("/", require("./routes/handleSprReport.routes"));
app.use("/", require("./routes/handleShipmentReport.routes"));
app.use("/", require("./routes/getPosition.routes"));

// SMARTSHEET ROUTES
app.use("/", require("./routes/getSheet.routes"));
app.use("/", require("./routes/weeklyTaskReport.routes"));
app.use("/", require("./routes/dailyTaskRefresh.routes"));

// IT PORTAL ROUTES
app.use("/", require("./routes/it-portal/verifyIdentityTemplate.routes"));
app.use("/", require("./routes/it-portal/getMyItems.routes"));
app.use("/", require("./routes/it-portal/getPublicItems.routes"));
app.use("/", require("./routes/it-portal/getAssetActions.routes"));
app.use("/", require("./routes/it-portal/getMyAssetInfo.routes"));
app.use("/", require("./routes/it-portal/getFileLinks.routes"));
app.use("/", require("./routes/it-portal/requestAssetAction.routes"));
app.use("/", require("./routes/it-portal/testMyEmployees.routes"));
app.use("/", require("./routes/it-portal/getEmployeeItems.routes"));

//error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Unhandled server error",
    error: err.message,
  });
});

app.listen(1902, () => {
  console.log(`Server running on port 1902`);
  console.log(`Environment: ${process.env.PROD === "true" ? "PROD" : "DEV"}`);
});
