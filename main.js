// ----- Déclaration des libraries -----
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const MailParser = require("mailparser").MailParser;
const shell = require('electron').shell;
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(app.getPath("userData") + '/archivage_mails.db');
const glob = require("glob");
const functions = require(`${__dirname}/src/functions.js`);
const decompress = require('decompress');
const decompressUnzip = require('decompress-unzip');
const chokidar = require('chokidar');

// ----- On ignore le certificat de sécurité -----
app.commandLine.appendSwitch('ignore-certificate-errors');

// ----- Déclaration des variables -----
let path_archive = app.getPath("userData") + "/Mails Archive";
let win;
const watcher = chokidar.watch(path_archive, {
  persistent: true,
  ignored: /.eml/,
  ignoreInitial: true,
});

// ----- Création de la fenêtre pour electron -----
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.resolve(`${__dirname}/src/preload.js`),
    }
  });
  win.maximize();
  // win.webContents.loadURL('https://roundcube.ida.melanie2.i2');
  win.webContents.loadURL('http://localhost/roundcube');
}

app.on("ready", createWindow);

// ----- Lancement des fonctions dans electron -----
launch();

watcher.on('add', path => {
  console.log(`File ${path} has been added`)
  setTimeout(function(){  launch(); }, 1000); 
})

// ----- Déclaration des fonctions -----
function launch() {
  zipDecompress().catch((err) => console.log(err)).finally(function () {
    arborescenceArchive().catch((err) => console.log(err)).finally(function () {
      indexationArchive();
    })
  })
}


function indexationArchive() {
  // On récupère la dernière date à laquelle le dossier à été modifié.
  let last_modif_date = Math.max(functions.getLastModifiedFolder(path_archive), functions.getLastModifiedFile(path_archive));

  db.serialize(function () {
    // On créer la bdd si elle n'existe pas.
    db.run('CREATE TABLE if not exists cols(id INTEGER PRIMARY KEY, subject TEXT, fromto TEXT, date INTEGER, path_file TEXT UNIQUE, break TEXT, modif_date INTEGER)');

    //On supprime les mails qui n'existe plus dans la bdd 
    readDir(path_archive + '/**/*.eml').then((files) => {
      db.all(functions.inParam(('SELECT * FROM cols WHERE path_file NOT IN (?#)'), files), files, function (err, rows) {
        rows.forEach((row) => {
          console.log("Suppression dans la base de données : " + row.path_file);
          db.prepare("DELETE FROM cols WHERE id = ?").run(row.id, function (err) {
            if (err) console.log(err.message);
          }).finalize();
        })
      })
    });

    // On récupère la dernière date à laquelle la BDD à été modifiée.
    db.get("SELECT MAX(modif_date) as modif_date FROM cols", function (err, row) {
      if (err) console.log(err);
      if (row.modif_date === null) {
        console.log("Aucune base de données détecté, insertion des fichiers dans la base");
        readDir(path_archive + '/**/*.eml').then((files) => {
          traitementColsFiles(files).then((promises) => {
            Promise.all(promises)
              .then((result) => {
                result.forEach((element) => {
                  db.prepare("INSERT INTO cols(id, subject, fromto, date, path_file, break, modif_date) VALUES(?,?,?,?,?,?,?)").run(null, element.subject, element.fromto, element.date, element.path_file, element.break, last_modif_date, function (err) {
                    if (err) console.log(err.message);
                  }).finalize();
                });
              });
          });
        });
      }
      else if (last_modif_date > row.modif_date) {
        console.log('Base de données non à jour, début du traitement');
        readDir(path_archive + '/**/*.eml').then((files) => {
          checkModifiedFiles(files, row.modif_date).then((promises) => {
            Promise.all(promises)
              .then((modified_files) => {
                traitementColsFiles(modified_files).then((promises) => {
                  Promise.all(promises)
                    .then((result) => {
                      result.forEach((value) => {
                        db.get("SELECT * FROM cols WHERE path_file = ?", value.path_file, function (err, row) {
                          if (err) console.log(err);
                          if (typeof row != 'undefined') {
                            console.log("Fichier mis à jour : " + value.path_file);
                            db.prepare("UPDATE cols SET subject = ?, fromto = ?, date = ?, break = ?, modif_date = ? WHERE path_file = ?", function (err) {
                              if (err) console.log(err);
                            }).run(value.subject, value.fromto, value.date, value.break, last_modif_date, value.path_file).finalize();
                          }
                          else {
                            console.log("Fichier inséré : " + value.path_file);
                            db.prepare("INSERT INTO cols(id, subject, fromto, date, path_file, break, modif_date) VALUES(?,?,?,?,?,?,?)", function (err) {
                              if (err) console.log(err);
                            }).run(null, value.subject, value.fromto, value.date, value.path_file, value.break, last_modif_date).finalize();
                          }
                        })
                      })
                    })
                })
              })
          })
        })
      }
      else {
        console.log('Base de données à jour');
      }
    });
  });
}

function zipDecompress() {
  return new Promise((resolve, reject) => {
    readDir(path_archive + '/*.zip').then((files) => {
      if (files.length) {
        for (let i = 0; i < files.length; i++) {
          decompress(files[i], path_archive, {
            plugins: [
              decompressUnzip()
            ]
          }).then(() => {
            console.log('Files decompressed');
            fs.unlinkSync(files[i])
            resolve();
          });
        }
      }
      else {
        reject('Pas de zip');
      }
    });
  });
}

function arborescenceArchive() {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(path_archive)) {
      if (!functions.isEmpty(path_archive)) {
        readDir(path_archive + '/*').then((files) => {
          for (let i = 0; i < files.length; i++) {
            let stats = fs.statSync(files[i]).isFile();
            if (!stats) {
              files.splice(i, 1)
            }
          }
          if (!files.length) {
            console.log('Arborescence des fichiers complète');
            resolve();
          }
          else {
            traitementColsFiles(files).then((promises) => {
              Promise.all(promises)
                .then((result) => {
                  result.forEach((value, index) => {
                    let file_name = value.path_file.split('/');
                    let date = new Date(value.date).toLocaleString('fr-FR', { timeZone: 'UTC' });
                    date = date.substr(0, 10).split('/');
                    let year = date[2];
                    let month = date[1];
                    let folder_month = year + '-' + month;
                    let file_path_year = path_archive + '/' + year;

                    fs.existsSync(file_path_year) ? "" : fs.mkdirSync(file_path_year);
                    fs.existsSync(file_path_year + '/' + folder_month) ? "" : fs.mkdirSync(file_path_year + '/' + folder_month);

                    fs.renameSync(value.path_file, file_path_year + '/' + folder_month + '/' + file_name[file_name.length - 1], (err) => {
                      if (err) throw err;
                    });

                    if (index == (files.length - 1)) {
                      resolve()
                    }
                  })
                });
            });
            console.log('Arborescence des fichiers mis à jour');
          }
        });
      }
      else {
        reject('Pas de mails archivés dans le dossier');
      }
    }
    else {
      fs.mkdirSync(path_archive);
      reject('Création du dossier Mails Archive');
    }
  });
}


ipcMain.on('read_mail_dir', (event, msg) => {
  new Promise((resolve, reject) => {
    db.all("SELECT * FROM cols WHERE break != 1 ORDER BY date DESC", (err, rows) => {
      if (err) {
        reject(err)
      }
      else {
        resolve(rows)
      }
    });
  }).then((value) => {
    win.webContents.send('mail_dir', value)
  })

})

ipcMain.on('attachment_select', (event, uid) => {
  try {
    new Promise((resolve, reject) => {
      db.get("SELECT path_file FROM cols WHERE id = ?", uid, (err, row) => {
        if (err) {
          reject(err)
        }
        else {
          resolve(row)
        }
      });
    }).then((row) => {
      let eml = fs.readFileSync(row.path_file, 'utf8');

      traitementAttachment(eml)
        .then((result) => {
          let path = app.getPath("temp") + '/' + result.filename;

          const options = {
            type: 'question',
            buttons: ['Cancel', 'Ouvrir', 'Enregistrer'],
            title: 'Ouverture de ' + result.filename,
            message: 'Que doit faire Mél avec ce fichier ?',
          };
          win.webContents.send('busy-loader')
          dialog.showMessageBox(null, options).then(response => {
            //Si on ouvre
            if (response.response === 1) {
              fs.writeFileSync(path, result.buf, (err) => {
                if (err) throw err;
              })
              shell.openPath(path);
            }
            //Si on enregistre
            else if (response.response === 2) {
              const options = {
                title: "Enregistrer un fichier",
                defaultPath: app.getPath('documents') + '/' + result.filename,
              }
              dialog.showSaveDialog(null, options).then(response => {
                fs.writeFileSync(response.filePath, result.buf, (err) => {
                  if (err) throw err;
                })
                shell.openPath(response.filePath);
              });
            }
          });
        })
    })
  }
  catch (err) {
    console.log(err);
  }
})

ipcMain.on('mail_select', (event, uid) => {
  fs.readFile('template/messagepreview.html', (err, data) => {
    if (err) {
      console.error(err)
      return
    }

    try {
      new Promise((resolve, reject) => {
        db.get("SELECT path_file FROM cols WHERE id = ?", uid, (err, row) => {
          if (err) {
            reject(err)
          }
          else {
            resolve(row)
          }
        });
      }).then((row) => {
        let eml = fs.readFileSync(row.path_file, 'utf8');

        traitementMail(eml).then((mail_content) => {
          let html = constructionMail(mail_content, data, uid);
          win.webContents.send('mail_return', html);
        })
      })
    }
    catch (err) {
      console.log(err);
    }
  })
});

//Parsage du mail pour afficher dans la liste
function traitementCols(eml, path_file) {
  return new Promise((resolve) => {
    let subject = "";
    let from = "";
    let date_fr = "";
    let mailparser = new MailParser();
    mailparser.on("headers", function (headers) {
      subject = headers.get('subject');
      from = headers.get('from');
      let date_fr = new Date(headers.get('date').getTime());
      // date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' });
      // date_fr = date_fr.getTime();
      try {
        resolve({ "subject": subject, "fromto": from.value[0].name, "date": date_fr, "path_file": path_file, "break": 0 });
      }
      catch (error) {
        resolve({ "subject": "", "fromto": "", "date": "", "path_file": "", "break": 1 });
      };
    });
    mailparser.write(eml);
    mailparser.end();
  })
}

//Parsage du mail pour récupérer les infos
function traitementMail(eml) {
  return new Promise((resolve) => {
    let attachments = [];
    let mail_content = {};
    var mailparser = new MailParser();
    mailparser.on("headers", function (headers) {
      mail_content.subject = headers.get('subject');
      mail_content.from = headers.get('from');
      mail_content.to = headers.get('to');
      mail_content.cc = headers.get('cc');
      mail_content.date = headers.get('date');
    });
    mailparser.on("data", function (mail_object) {
      if (mail_object.type === 'attachment') {
        let bufs = [];
        let attachment_content = [];

        attachment_content['contentDisposition'] = mail_object.contentDisposition;

        attachment_content['cid'] = mail_object.cid;
        attachment_content['ctype'] = mail_object.contentType;
        attachment_content['filename'] = mail_object.filename;


        mail_object.content.on('data', function (d) {
          bufs.push(d);
        });
        mail_object.content.on('end', function () {
          attachment_content['buf'] = Buffer.concat(bufs);
          attachments.push(attachment_content);
          mail_object.release()
        });
      }
      if (mail_object.type === 'text') {
        (mail_object.html == undefined) ? object = mail_object.textAsHtml : object = mail_object.html;
        mail_content.object = object;

        mail_content.attachments = attachments;
        resolve(mail_content);
      }
    });
    mailparser.write(eml);
    mailparser.end();
  })
}

//Parsage du mail pour récupérer les pièces jointes
function traitementAttachment(eml) {
  return new Promise((resolve) => {
    var mailparser = new MailParser();
    let attachment_content = {};
    mailparser.on("data", function (mail_object) {
      if (mail_object.type === 'attachment') {
        let bufs = [];

        attachment_content.contentDisposition = mail_object.contentDisposition;

        attachment_content.cid = mail_object.cid;
        attachment_content.ctype = mail_object.contentType;
        attachment_content.filename = mail_object.filename;

        mail_object.content.on('data', function (d) {
          bufs.push(d);
        });
        mail_object.content.on('end', function () {
          attachment_content.buf = Buffer.concat(bufs);
          mail_object.release()
        });
      }
      if (mail_object.type === 'text') {
        resolve(attachment_content);
      }
    });
    mailparser.write(eml);
    mailparser.end();
  })
}

//Assemblage du mail et du html
function constructionMail(result, data, uid) {
  let to = "";
  let cc = "";
  let i = 0;
  let surplusTo = [];
  let surplusCc = [];
  let html = data.toString();

  html = html.replace("%%SUBJECT%%", result.subject);
  html = html.replace("%%FROM_NAME%%", result.from.value[0].name);
  html = html.replace("%%FROM%%", result.from.value[0].address);

  let virgule = "";
  to = '<tr><td class="header-title">À</td><td class="header to">';
  result.to.value.forEach(value => {
    i++;
    if (i <= 5) {
      if (value.name != "") {
        to += virgule + "<span class='adr'><a href='#' class='rcmContactAddress' title = " + value.address + ">" + value.name + "</a></span>";
      }
      else {
        to += virgule + "<span class='adr'><a href='#' class='rcmContactAddress' title = " + value.address + ">" + value.address + "</a></span>";
      }
      virgule = ", ";
    }
    else {
      surplusTo.push(value.address);
    }
  })
  if (surplusTo.length > 0) {
    to += "<a class='morelink' href='#' title='" + surplusTo + "'>" + (i - 5) + " de plus... </a>"
  }
  to += '</td></tr>';


  if (result.cc != undefined) {
    i = 0;
    cc = '<tr><td class="header-title">Cc</td><td class="header cc">';
    virgule = "";
    result.cc.value.forEach(value => {
      i++;
      if (i <= 5) {
        if (value.name != "") {
          cc += virgule + "<span class='adr'><a href='#' class='rcmContactAddress' title = " + value.address + ">" + value.name + "</a></span>";
        }
        else {
          cc += virgule + "<span class='adr'><a href='#' class='rcmContactAddress' title = " + value.address + ">" + value.address + "</a></span>";
        }
        virgule = ", ";
      }
      else {
        surplusCc.push(value.address);
      }
    })
    if (surplusCc.length > 0) {
      cc += "<a class='morelink' href='#' title='" + surplusCc + "'>" + (i - 5) + " de plus... </a>"
    }
    cc += '</td></tr>';
  }

  html = html.replace("%%TOCC%%", to + cc);

  let date = new Date(result.date);
  let date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' })
  html = html.replace("%%DATE%%", date_fr);

  const regex = /(<style(.*?)*)(\n.*?)*<\/style>/;
  html = html.replace("%%OBJECT%%", result.object.replace(regex, ""));

  //Traitement des pièces jointes
  if (result.attachments != []) {
    result.attachments.forEach(element => {
      if (element['contentDisposition'] != "attachment") {
        html = html.replace('cid:' + element['cid'], "data:" + element['ctype'] + ";base64, " + element['buf'].toString('base64'));
      }
      else {
        let filename = element['filename'];
        let ctype = element['ctype'].split('/');
        let size = " (~" + functions.formatBytes(element['buf'].toString().length, 0) + ")";

        html = html.replace('style="display: none;"', '');
        html = html.replace('%%ATTACHMENT%%', "<li id='attach2' class='application " + ctype[1] + "'><a href='#' onclick='openAttachment(" + uid + ")' id='attachment' title='" + filename + size + "'>" + filename + size + "</a></li>%%ATTACHMENT%%");
      }
    })
  }

  html = html.replace('%%ATTACHMENT%%', '');
  return html;
}

function readDir(path) {
  return new Promise((resolve) => {
    glob(path, (err, files) => {
      resolve(files);
    });
  });
}

function traitementColsFiles(files) {
  return new Promise((resolve) => {
    let promises = [];
    new Promise((resolve) => {
      files.forEach((file) => {
        try {
          new Promise((resolve) => {
            fs.readFile(file, 'utf8', (err, eml) => {
              if (err) console.log(err);
              resolve(eml);
            });
          }).then((eml) => {
            promises.push(traitementCols(eml, file));
            if (promises.length == files.length) {
              resolve();
            };
          })
        }
        catch (err) {
          console.error(err);
        }
      });
    }).then(() => resolve(promises));
  })
}

function checkModifiedFiles(files, row_modif_date) {
  return new Promise((resolve) => {
    let modified_file = [];
    new Promise((resolve, reject) => {
      files.forEach((file, index, array) => {
        try {
          new Promise((resolve) => {
            fs.stat(file, (err, stats) => {
              if (err) console.log(err);
              resolve(stats.atime.getTime());
            });
          }).then((file_time) => {
            if (file_time > row_modif_date) {
              modified_file.push(file);
            }
            if (index === array.length - 1) {
              resolve()
            };
          })
        }
        catch (err) {
          console.error(err);
        }
      });
    }).then(() => resolve(modified_file));
  })
}
