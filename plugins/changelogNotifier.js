module.exports = {
  afterUpdate: ({ args }) => {
    if (!args || args.length < 2) return;
    const pkg = args[1];
    // Placeholder: In real use, fetch from npm or GitHub API
    console.log(`[changelogNotifier] Updated ${pkg}. (Fetch and display changelog here.)`);
  },
}; 