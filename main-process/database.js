const { app, BrowserWindow } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const functions = require('./functions.js');

createDB();

function createDB() {
  const db = new sqlite3.Database(path.join(app.getPath("userData"), 'archivage_mails.db'));
  // Création de la bdd si elle n'existe pas.
  db.run('CREATE TABLE if not exists cols(id INTEGER PRIMARY KEY, subject TEXT, fromto TEXT, date INTEGER, path_file TEXT UNIQUE, subfolder TEXT, break TEXT, content_type TEXT, etiquettes TEXT, modif_date INTEGER)');

  db.close();
}


module.exports = {
  db_search(search_request) {
    try {
      const db = new sqlite3.Database(path.join(app.getPath("userData"), 'archivage_mails.db'));
      return new Promise((resolve, reject) => {
        db.all("SELECT * FROM cols WHERE break != 1 AND subject LIKE '%" + search_request.value + "%' AND subfolder = '" + search_request.subfolder + "' ORDER BY date DESC", (err, rows) => {
          if (err) {
            reject(err)
          }
          else {
            resolve(rows)
          }
        });
      })
      db.close();
    }
    catch (err) { console.log(err) }
  },

  db_read_mail_dir(file_path) {
    try {
      const db = new sqlite3.Database(path.join(app.getPath("userData"), 'archivage_mails.db'));
      return new Promise((resolve, reject) => {
        db.all("SELECT * FROM cols WHERE break != 1 AND subfolder = '" + file_path + "' ORDER BY date DESC", (err, rows) => {
          if (err) {
            reject(err)
          }
          else {
            resolve(rows)
          }
        });
      })
      db.close()
    }
    catch (err) { console.log(err) }
  },

  db_mail_select(uid) {
    try {
      const db = new sqlite3.Database(path.join(app.getPath("userData"), 'archivage_mails.db'));
      return new Promise((resolve, reject) => {
        db.get("SELECT path_file FROM cols WHERE id = ?", uid, (err, row) => {
          if (err) {
            reject(err)
          }
          else {
            resolve(row)
          }
        });
      })
      db.close();
    }
    catch (err) { console.log(err) }
  },

  db_attachment_select(value) {
    try {
      return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(path.join(app.getPath("userData"), 'archivage_mails.db'));
        db.get("SELECT path_file FROM cols WHERE id = ?", value.uid, (err, row) => {
          if (err) {
            reject(err)
          }
          else {
            resolve(row)
          }
        });
      })
      db.close()
    }
    catch (err) { console.log(err) }
  },

  db_insert_archive(element) {
    try {
      const db = new sqlite3.Database(path.join(app.getPath("userData"), 'archivage_mails.db'));
      db.prepare("INSERT INTO cols(id, subject, fromto, date, path_file, subfolder, break, content_type, etiquettes) VALUES(?,?,?,?,?,?,?,?,?)").run(null, element.subject, element.fromto, element.date, element.path_file, functions.getSubfolder(element.path_file), element.break, element.content_type, element.etiquettes, function (err) {
        if (err) console.log(err.message);
        else BrowserWindow.getAllWindows()[0].send('add_message_row', { id: this.lastID, subject: element.subject, fromto: element.fromto, date: element.date, content_type: element.content_type, mbox: functions.getSubfolder(element.path_file), etiquettes: element.etiquettes });
      }).finalize();
      db.close();
    }
    catch (err) { console.log(err) }
  },

  db_update_etiquettes(uid, etiquettes) {
    try {
      const db = new sqlite3.Database(path.join(app.getPath("userData"), 'archivage_mails.db'));
      db.run("UPDATE cols SET etiquettes = ? WHERE id = ?", etiquettes, uid);
      db.close()
    }
    catch (err) { console.log(err) }
  }
}