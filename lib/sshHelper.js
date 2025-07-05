"use strict";
const { execSync, spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
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
    try {
        const sshKey = execSync('ssh-add -l', { encoding: 'utf8', stdio: 'pipe' });
        if (sshKey && !sshKey.includes('no identities')) {
            // SSH key is available, use SSH URL instead of HTTPS
            return { useSSH: true };
        }
    }
    catch (err) {
        // SSH key not available or ssh-add failed
    }
    return headers;
}
module.exports = {
    downloadWithSSH,
    getGitHubAuthHeaders
};
