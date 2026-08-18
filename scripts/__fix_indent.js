const fs = require('fs');
const f = 'components/auth/LoginModal.tsx';
let c = fs.readFileSync(f, 'utf8');

// Fix outer div indentation (line 37): should be exactly 4 spaces
c = c.replace(
  /\n\s*<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black\/75 backdrop-blur-xs min-h-screen overflow-y-auto">/,
  '\n    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs min-h-screen overflow-y-auto">'
);

fs.writeFileSync(f, c, 'utf8');
console.log('Fixed indentation');

const lines = c.split('\n');
for (let i = 35; i <= 40 && i < lines.length; i++) {
  console.log((i+1) + ': ' + JSON.stringify(lines[i].substring(0, 100)));
}
