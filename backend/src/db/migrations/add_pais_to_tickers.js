export default async function migrate(db) {
    try {
        db.prepare('ALTER TABLE tickers ADD COLUMN pais TEXT').run()
        console.log('Columna pais agregada a tickers')
    } catch (e) {
        if (!e.message.includes('duplicate column name')) {
            throw e
        }
    }
}
