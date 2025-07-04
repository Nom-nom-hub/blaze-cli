require("dotenv").config();
function notifySocial() {
  const slack = process.env.SLACK_WEBHOOK_URL;
  const discord = process.env.DISCORD_WEBHOOK_URL;
  const twitter = process.env.TWITTER_API_KEY;
  if (!slack && !discord && !twitter) {
    console.warn(
      "[socialNotifier] No webhook/API keys set in .env. Skipping notification.",
    );
    return;
  }
  // TODO: Add real notification logic here using the keys
  if (slack) console.log("[socialNotifier] Would notify Slack.");
  if (discord) console.log("[socialNotifier] Would notify Discord.");
  if (twitter) console.log("[socialNotifier] Would notify Twitter.");
}

module.exports = {
  afterInstall: notifySocial,
  afterUpdate: notifySocial,
};
