function reportVulns() {
  // Placeholder: In a real implementation, auto-file GitHub issue or send email
  console.log('[vulnAutoReporter] (Placeholder) Auto-file GitHub issue or send email if critical vuln found.');
}

module.exports = {
  afterInstall: reportVulns,
  afterUpdate: reportVulns,
}; 