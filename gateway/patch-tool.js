let fs = require('fs');
let patch = require('jsonpatch');
// console.log(process.argv)
// let doc = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let doc = JSON.parse(fs.readFileSync(0));
// console.log(doc);
let ops = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
// console.log(ops);
patcheddoc = patch.apply_patch(doc, ops);
console.log(JSON.stringify(patcheddoc));
