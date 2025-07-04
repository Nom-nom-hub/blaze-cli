const chalk = require('chalk');

class Spinner {
  constructor(text) {
    this.text = text;
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.interval = null;
    this.frameIndex = 0;
  }

  start() {
    if (process.stdout.isTTY) {
      process.stdout.write(chalk.cyan(`\n${this.frames[this.frameIndex]} ${this.text}`));
      this.interval = setInterval(() => {
        this.frameIndex = (this.frameIndex + 1) % this.frames.length;
        process.stdout.write(chalk.cyan(`\r${this.frames[this.frameIndex]} ${this.text}`));
      }, 80);
    } else {
      console.log(chalk.cyan(`\n⏳ ${this.text}...`));
    }
  }

  stop(message, success = true) {
    if (this.interval) {
      clearInterval(this.interval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
    if (success) {
      console.log(chalk.green(`✅ ${message || this.text + ' complete.'}`));
    } else {
      console.error(chalk.red(`❌ ${message || this.text + ' failed.'}`));
    }
  }
}

module.exports = Spinner;