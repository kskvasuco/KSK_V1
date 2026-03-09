const fs = require('fs');
let text = "Size: ";
if (fs.existsSync("client/public/tamil_font.ttf")) {
    text += fs.statSync("client/public/tamil_font.ttf").size;
} else {
    text += "NOT FOUND";
}
fs.writeFileSync("size.txt", text);
