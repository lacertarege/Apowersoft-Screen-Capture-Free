
const dStart = new Date('2023-07-15')
const dEnd = new Date() // uses system time

console.log(`Start: ${dStart.toISOString()}`)
console.log(`End: ${dEnd.toISOString()}`)

// Logic from backend
const mesesDisponibles = []
const cur = new Date(dStart.getFullYear(), dStart.getMonth(), 1)

// Debug: print loop conditions
console.log(`Loop init cur: ${cur.toISOString()}`)
console.log(`cur <= dEnd? ${cur <= dEnd}`)

let safety = 0
while (cur <= dEnd && safety < 1000) {
    const y = cur.getFullYear()
    const m = cur.getMonth() + 1
    mesesDisponibles.push(`${y}-${String(m).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
    safety++
}

console.log(`Generated ${mesesDisponibles.length} months`)
console.log(mesesDisponibles)
