export default async function seed(db){
  const count = db.prepare('SELECT COUNT(*) as c FROM tipos_inversion').get().c
  if (count === 0) {
    db.prepare('INSERT INTO tipos_inversion (nombre, activo) VALUES (?,1)').run('Acciones')
    db.prepare('INSERT INTO tipos_inversion (nombre, activo) VALUES (?,1)').run('ETFs')
    db.prepare('INSERT INTO tipos_inversion (nombre, activo) VALUES (?,1)').run('Fondos Mutuos')
    db.prepare('INSERT INTO tipos_inversion (nombre, activo) VALUES (?,1)').run('Seguros')
  }
}