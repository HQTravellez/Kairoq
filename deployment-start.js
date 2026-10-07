const fs = require("fs");
const path = require("path");
const workspace = path.join(__dirname, "workspace");
const generated = path.join(__dirname, "public", "generated");
const durable = path.join(workspace, "generated");
fs.mkdirSync(durable, { recursive: true });
if (fs.existsSync(generated) && !fs.lstatSync(generated).isSymbolicLink()) {
  fs.cpSync(generated, durable, { recursive: true, force: false });
  fs.rmSync(generated, { recursive: true });
}
if (!fs.existsSync(generated)) fs.symlinkSync(durable, generated, "dir");
require("./server.js");
