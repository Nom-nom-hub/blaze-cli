"use strict";
function printBanner() {
    console.log("==============================");
    console.log("   Welcome to blaze-install!   ");
    console.log("==============================");
}
module.exports = {
    afterInstall: printBanner,
    afterUpdate: printBanner,
};
