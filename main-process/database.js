const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const functions = require('./functions.js');
const db = new sqlite3.Database(path.join(app.getPath("userData"), 'archivage_mails.db'));


// Création de la bdd si elle n'existe pas.
db.run('CREATE TABLE if not exists cols(id INTEGER PRIMARY KEY, subject TEXT, fromto TEXT, date INTEGER, path_file TEXT UNIQUE, subfolder TEXT, break TEXT, content_type TEXT, modif_date INTEGER)');

module.exports = {
  db_search(search_request) {
    try {
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
    }
    catch (err) { console.log(err) }
  },

  db_read_mail_dir(path) {
    try {
      return new Promise((resolve, reject) => {
        db.all("SELECT * FROM cols WHERE break != 1 AND subfolder = '" + path + "' ORDER BY date DESC", (err, rows) => {
          if (err) {
            reject(err)
          }
          else {
            resolve(rows)
          }
        });
      })
    }
    catch (err) { console.log(err) }
  },

  db_mail_select(uid) {
    try {
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
    }
    catch (err) { console.log(err) }
  },

  db_attachment_select(value) {
    try {
      return new Promise((resolve, reject) => {
        db.get("SELECT path_file FROM cols WHERE id = ?", value.uid, (err, row) => {
          if (err) {
            reject(err)
          }
          else {
            resolve(row)
          }
        });
      })
    }
    catch (err) { console.log(err) }
  },

  db_insert_archive(element) {
    try {
      db.prepare("INSERT INTO cols(id, subject, fromto, date, path_file, subfolder, break, modif_date, content_type) VALUES(?,?,?,?,?,?,?,?,?)").run(null, element.subject, element.fromto, element.date, element.path_file, functions.getSubfolder(element.path_file), element.break, last_modif_date, element.content_type, function (err) {
        if (err) console.log(err.message);
      }).finalize();
    }
    catch (err) { console.log(err) }
  }
}