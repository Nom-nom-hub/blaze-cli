# 🔧 Fix SSH Key Detection and Default Branch Handling

## 🐛 Issues Fixed

### 1. **SSH Key Detection on macOS/Other Platforms**
**Problem:** Blaze used `ssh-add -l` to check for SSH keys, which returns "no identities" on macOS even when SSH keys exist in `~/.ssh/`.

**Solution:** Now checks for SSH key files directly in the user's `~/.ssh/` directory:
- Looks for common SSH key types: `id_rsa`, `id_ed25519`, `id_ecdsa`, `id_dsa`
- Checks both private keys and public keys (`.pub` files)
- Falls back gracefully if `.ssh` directory doesn't exist

### 2. **Default Branch Detection**
**Problem:** Blaze hardcoded `'main'` as the default branch, but npm follows Git's default behavior by querying the repository's actual default branch.

**Solution:** Now queries the GitHub API to get the repository's default branch:
- Calls `https://api.github.com/repos/{user}/{repo}` to get `default_branch`
- Falls back to `'main'` if API call fails (with warning)
- Supports GitHub token authentication for private repos

## 🔄 Changes Made

### **Files Modified:**
- `src/sshHelper.js` - Added `hasSSHKeys()` and `getDefaultBranch()` functions
- `src/installTree.js` - Updated `parseGithubSpec()` to be async and use default branch detection
- `lib/sshHelper.js` - Mirror changes for compiled output
- `lib/installTree.js` - Mirror changes for compiled output

### **Key Functions Added:**
```javascript
// Check for SSH keys in ~/.ssh directory
async function hasSSHKeys()

// Get default branch from GitHub API
async function getDefaultBranch(user, repo)
```

### **Breaking Changes:**
- `parseGithubSpec()` is now async (internal change)
- `validateGithubOrTarballSpec()` is now async (internal change)

## ✅ Testing

### **SSH Key Detection Test:**
- ✅ Tested with private GitHub repo (`Nom-nom-hub/ForeverMissed`)
- ✅ Confirmed SSH authentication works without `ssh-add -l`
- ✅ Verified fallback to HTTPS when no SSH keys found

### **Default Branch Test:**
- ✅ Tested with repo using non-`main` default branch
- ✅ Confirmed correct branch is fetched automatically
- ✅ Verified fallback to `'main'` with warning when API fails

### **Regression Tests:**
- ✅ Public repos still work correctly
- ✅ Explicit branch specifications still work
- ✅ Tarball URLs still work
- ✅ All existing functionality preserved

## 🚀 Impact

### **For Users:**
- **macOS users:** SSH key detection now works correctly
- **Private repos:** Better default branch handling
- **Cross-platform:** More reliable SSH detection across all platforms

### **For Developers:**
- **More robust:** Better error handling and fallbacks
- **GitHub API integration:** Uses official GitHub API for branch detection
- **Backward compatible:** No breaking changes for end users

## 📋 Checklist

- [x] SSH key detection works on macOS
- [x] Default branch detection works for non-`main` repos
- [x] Fallback mechanisms work correctly
- [x] No regressions in existing functionality
- [x] Code is properly tested
- [x] Both `src/` and `lib/` files updated
- [x] Version bumped to 1.11.7

## 🔗 Related Issues

Fixes issues reported by Reddit user regarding:
1. SSH key detection returning "no identities" on macOS
2. Default branch hardcoded to "main" instead of following Git behavior

---

**Ready for review and merge! 🎉** 