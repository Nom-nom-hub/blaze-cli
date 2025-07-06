"use strict";
const { execSync, spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const axios = require('axios');
/**
 * Download a GitHub repository using SSH and create a tarball
 * @param {string} sshUrl - SSH URL of the repository
 * @param {string} ref - Branch, tag, or commit reference
 * @param {string} dest - Destination path for the tarball
 * @param {boolean} isVerbose - Whether to log verbose output
 * @returns {Promise<void>}
 */
async function downloadWithSSH(sshUrl, ref, dest, isVerbose = false) {
    // Use crypto.randomBytes for safer uniqueness than Date.now()
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const tempDir = path.join(os.tmpdir(), `blaze-ssh-${randomSuffix}`);
    try {
        // Clone the repo using async spawn instead of blocking execSync
        await new Promise((resolve, reject) => {
            const cloneProcess = spawn('git', ['clone', '--depth', '1', '--branch', ref, sshUrl, tempDir], {
                stdio: 'pipe'
            });
            cloneProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Git clone failed with code ${code}`));
                }
            });
            cloneProcess.on('error', (err) => {
                reject(new Error(`Git clone failed: ${err.message}`));
            });
        });
        // Create tarball using async spawn
        await new Promise((resolve, reject) => {
            const tarProcess = spawn('tar', ['-czf', dest, '-C', tempDir, '.'], {
                stdio: 'pipe'
            });
            tarProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`Tar creation failed with code ${code}`));
                }
            });
            tarProcess.on('error', (err) => {
                reject(new Error(`Tar creation failed: ${err.message}`));
            });
        });
        if (isVerbose) {
            console.log(`Downloaded via SSH: ${sshUrl}#${ref}`);
        }
    }
    catch (err) {
        // Provide more informative error messages
        if (err.message.includes('git clone')) {
            throw new Error(`Failed to clone repository ${sshUrl}: ${err.message}. Make sure your SSH key is added to ssh-agent and you have access to the repository.`);
        }
        else if (err.message.includes('tar')) {
            throw new Error(`Failed to create tarball from ${sshUrl}: ${err.message}`);
        }
        throw err;
    }
    finally {
        // Clean up temp directory
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        }
        catch (err) {
            // Ignore cleanup errors
        }
    }
}
/**
 * Get GitHub authentication headers (supports both token and SSH)
 * @returns {Promise<Object>} Headers object or { useSSH: true } for SSH
 */
async function getGitHubAuthHeaders() {
    const headers = {};
    // First try GITHUB_TOKEN
    const token = process.env.GITHUB_TOKEN;
    if (token) {
        headers['Authorization'] = `token ${token}`;
        return headers;
    }
    // Then try SSH key authentication
    const hasKeys = await hasSSHKeys();
    if (hasKeys) {
        // SSH key is available, use SSH URL instead of HTTPS
        return { useSSH: true };
    }
    return headers;
}
/**
 * Check if SSH keys exist in the user's .ssh directory
 * @returns {Promise<boolean>} True if SSH keys are found
 */
async function hasSSHKeys() {
    const sshDir = path.join(os.homedir(), '.ssh');
    try {
        // Check if .ssh directory exists
        await fs.access(sshDir);
        // Look for common SSH key files
        const keyFiles = [
            'id_rsa',
            'id_ed25519',
            'id_ecdsa',
            'id_dsa'
        ];
        for (const keyFile of keyFiles) {
            try {
                await fs.access(path.join(sshDir, keyFile));
                return true; // Found at least one SSH key
            }
            catch {
                // Key file doesn't exist, continue checking others
            }
        }
        // Also check for keys with .pub extension
        const pubKeyFiles = [
            'id_rsa.pub',
            'id_ed25519.pub',
            'id_ecdsa.pub',
            'id_dsa.pub'
        ];
        for (const pubKeyFile of pubKeyFiles) {
            try {
                await fs.access(path.join(sshDir, pubKeyFile));
                return true; // Found at least one SSH public key
            }
            catch {
                // Key file doesn't exist, continue checking others
            }
        }
        return false; // No SSH keys found
    }
    catch {
        // .ssh directory doesn't exist
        return false;
    }
}
/**
 * Get the default branch for a GitHub repository
 * @param {string} user - GitHub username
 * @param {string} repo - Repository name
 * @returns {Promise<string>} Default branch name
 */
async function getDefaultBranch(user, repo) {
    try {
        // Try to get default branch from GitHub API
        const headers = {};
        const token = process.env.GITHUB_TOKEN;
        if (token) {
            headers['Authorization'] = `token ${token}`;
        }
        const response = await axios.get(`https://api.github.com/repos/${user}/${repo}`, { headers });
        return response.data.default_branch || 'main';
    }
    catch (err) {
        // If API call fails, fall back to 'main' as default
        console.warn(`Warning: Could not determine default branch for ${user}/${repo}, using 'main' as fallback`);
        return 'main';
    }
}
module.exports = {
    downloadWithSSH,
    getGitHubAuthHeaders,
    hasSSHKeys,
    getDefaultBranch
};
