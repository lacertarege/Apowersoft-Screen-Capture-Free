// Simple guard to prevent running dev/build if leftover diff markers are present in source files
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

const PATTERNS = [
  /^\s*[+\-]\s*<.*/m,          // lines like "+    <div>" or "-    <div>"
  /^<<<<<<<|^=======|^>>>>>>>/m, // git merge conflict markers
]

/** Recursively collect files under dir */
function walk(dir){
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })){
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(jsx?|tsx?|css|html|json)$/i.test(entry.name)) out.push(full)
  }
  return out
}

function hasMarkers(content){
  return PATTERNS.some(re => re.test(content))
}

const offenders = []
for (const file of walk(SRC)){
  const txt = fs.readFileSync(file, 'utf8')
  if (hasMarkers(txt)) offenders.push(path.relative(ROOT, file))
}

if (offenders.length){
  console.error('\n✖ Se detectaron marcadores de diff o conflictos en:')
  for (const f of offenders) console.error('  -', f)
  console.error('\nPor favor limpia esos marcadores antes de ejecutar dev/build.')
  process.exit(1)
}else{
  console.log('✓ Verificación de marcadores OK')
}