const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const chalk = require("chalk");

/**
 * Initialize a new package.json in the current directory
 */
async function initPackageJson() {
  const pkgPath = path.join(process.cwd(), "package.json");
  
  let rawName = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  // Replace multiple hyphens with a single one, and trim leading/trailing hyphens
  let sanitizedName = rawName.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (!sanitizedName) sanitizedName = "package";
  
  const defaultPkg = {
    name: sanitizedName,
    version: "1.0.0",
    description: "",
    main: "index.js",
    scripts: {
      test: "echo \"Error: no test specified\" && exit 1"
    },
    keywords: [],
    author: "",
    license: "ISC"
  };
  
  try {
    // Use atomic file creation to avoid race conditions
    await fs.writeFile(pkgPath, JSON.stringify(defaultPkg, null, 2) + "\n", { flag: 'wx', encoding: 'utf-8' });
    console.log(chalk.green("✅ Created package.json"));
    console.log(chalk.cyan("📝 Edit package.json to add your project details"));
  } catch (error) {
    if (error.code === 'EEXIST') {
      console.log(chalk.yellow("⚠️ package.json already exists in this directory."));
    } else {
      throw error;
    }
  }
}

/**
 * Parse npm alias syntax: alias@npm:real-pkg@range
 * @param {string} versionRange - The version range to parse
 * @returns {Object|null} - Parsed alias info or null if not an alias
 */
function parseNpmAlias(versionRange) {
  if (typeof versionRange === "string" && versionRange.startsWith("npm:")) {
    const match = versionRange.match(/^npm:([^@]+)@(.+)$/);
    if (match) {
      return {
        realPkg: match[1],
        realRange: match[2]
      };
    }
  }
  return null;
}

/**
 * Resolve npm alias with cycle detection and depth limiting
 * @param {string} name - Package name
 * @param {string} versionRange - Version range
 * @param {Function} worker - Worker function for recursive resolution
 * @param {Object} resolved - Resolved packages object
 * @param {Array} aliasChain - Current alias resolution chain (for cycle detection)
 * @param {number} maxDepth - Maximum alias depth (default: 10)
 */
async function resolveNpmAlias(name, versionRange, worker, resolved, aliasChain = [], maxDepth = 10) {
  const aliasInfo = parseNpmAlias(versionRange);
  if (!aliasInfo) {
    return false; // Not an alias
  }

  const { realPkg, realRange } = aliasInfo;

  // Alias cycle detection and depth limiting
  if (aliasChain.includes(name)) {
    throw new Error(`Alias cycle detected: ${[...aliasChain, name].join(" -> ")}`);
  }
  if (aliasChain.length >= maxDepth) {
    throw new Error(`Alias chain too deep (>${maxDepth}): ${[...aliasChain, name].join(" -> ")}`);
  }

  // Create new chain with current alias
  const newAliasChain = [...aliasChain, name];
  
  // Recursively resolve the real package with the new chain
  await worker([realPkg, realRange], newAliasChain);

  // Copy the resolved real package under the alias name
  resolved[name] = {
    ...resolved[realPkg],
    _alias: true,
    _realPackage: realPkg
  };

  return true; // Alias was resolved
}

module.exports = {
  initPackageJson,
  parseNpmAlias,
  resolveNpmAlias
}; 