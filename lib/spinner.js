"use strict";
// Minimal CLI spinner for Blaze CLI
// Usage: const spinner = new Spinner('Installing...'); spinner.start(); ... spinner.succeed('Done!');
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
class Spinner {
    constructor(text = '') {
        this.text = text;
        this.frameIndex = 0;
        this.timer = null;
        this.isSpinning = false;
    }
    start(text) {
        if (text)
            this.text = text;
        if (this.isSpinning)
            return;
        this.isSpinning = true;
        this.timer = setInterval(() => {
            this.render();
        }, 80);
    }
    stop() {
        if (!this.isSpinning)
            return;
        clearInterval(this.timer);
        this.isSpinning = false;
        process.stdout.write('\r');
    }
    succeed(msg) {
        this.stop();
        process.stdout.write(`\r✔️  ${msg || this.text}\n`);
    }
    fail(msg) {
        this.stop();
        process.stdout.write(`\r❌ ${msg || this.text}\n`);
    }
    render() {
        const frame = spinnerFrames[this.frameIndex = (this.frameIndex + 1) % spinnerFrames.length];
        process.stdout.write(`\r${frame} ${this.text}`);
    }
}
module.exports = Spinner;
