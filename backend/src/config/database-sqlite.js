const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');

class SQLitePool {
  constructor() {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
      }
    });
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({ rows });
          }
        });
      } else {
        this.db.run(sql, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ 
              rows: [{ id: this.lastID }],
              rowCount: this.changes 
            });
          }
        });
      }
    });
  }

  connect() {
    return {
      query: this.query.bind(this),
      release: () => {}
    };
  }
}

module.exports = new SQLitePool();