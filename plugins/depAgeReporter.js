function reportDepAges() {
  // Placeholder: In a real implementation, check npm registry for last publish date
  console.log('[depAgeReporter] (Placeholder) Warn if any dependency hasn\'t been updated in X months.');
}

module.exports = {
  afterInstall: reportDepAges,
  afterUpdate: reportDepAges,
}; 