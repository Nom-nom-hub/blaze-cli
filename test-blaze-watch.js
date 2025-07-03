const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const testFile = 'blaze-watch-test.js';
if (fs.existsSync(testFile)) fs.unlinkSync(testFile);

// Step 1: Write a file with a missing require
fs.writeFileSync(testFile, "console.log('Hello world!');\n");
console.log('Wrote initial test file.');

// Step 2: Wait a moment, then add a require for a package not yet installed
setTimeout(() => {
  fs.appendFileSync(testFile, "const leftPad = require('left-pad');\nconsole.log(leftPad('test', 5));\n");
  console.log('Appended require statement for left-pad.');

  // Step 3: Wait a bit, then check if left-pad was installed
  setTimeout(() => {
    const nm = path.join('node_modules', 'left-pad');
    if (fs.existsSync(nm)) {
      console.log('SUCCESS: left-pad was auto-installed by blaze watch!');
    } else {
      console.error('FAIL: left-pad was NOT auto-installed.');
    }
    process.exit(0);
  }, 8000);
}, 4000); 