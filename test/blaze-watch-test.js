console.log("Hello world!");
const leftPad = require("left-pad");
console.log(leftPad("test", 5));
const uniq = require("uniq");
console.log(uniq([1, 2, 2, 3, 4, 4, 5]));
const isOdd = require("is-odd");
const randomColor = require("randomcolor");
console.log(isOdd(3), randomColor());
