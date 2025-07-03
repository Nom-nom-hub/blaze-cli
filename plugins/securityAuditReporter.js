module.exports = {
  afterAudit: () => {
    // Placeholder for sending to Slack/Discord/email
    console.log('[securityAuditReporter] Audit completed. (To send results to webhook, add your integration here.)');
  },
}; 