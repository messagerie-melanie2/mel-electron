const { app, dialog, ipcMain, shell, BrowserWindow, session } = require('electron');
const { download } = require("electron-dl");
const functions = require('./functions.js');
const db = require('./database.js');
const mail = require('./mail.js');
const dree = require('dree');
const path = require('path');
const fs = require('fs');

// Envoi le nom du dossier d'archive au plugin electron 
ipcMain.on('get_archive_folder', (event, msg) => {
  event.sender.send('archive_folder', process.env.ARCHIVE_FOLDER);
});

// Envoi la liste des sous-dossier dans le dossier 'Mails archive'
ipcMain.on('subfolder', (event, msg) => {
  const options = {
    extensions: []
  }
  const tree = dree.scan(process.env.PATH_ARCHIVE, options);
  event.sender.send('listSubfolder', tree.children)
});

// Recherche de l'utilisateur dans la BDD 
ipcMain.on('search_list', (event, search_request) => {
  db.db_search(search_request).then((value) => {
    event.sender.send('result_search', value)
  })
});

// Envoi la liste des mails d'un dossier
ipcMain.on('read_mail_dir', (event, path) => {
  db.db_read_mail_dir(path).then((value) => {
    event.sender.send('mail_dir', value)
  });
})

// Envoi le mail sélectionné au format html 
ipcMain.on('mail_select', (event, uid) => {
  if (uid != null) {
    const template = (process.env.DEV_MODE == "Dev") ? 'template/messagepreview.html' : path.join(process.resourcesPath, 'template/messagepreview.html');
    fs.readFile(template, (err, data) => {
      if (err) {
        console.error(err)
        return
      }

      db.db_mail_select(uid).then((row) => {

        let eml = fs.readFileSync(path.join(process.env.PATH_ARCHIVE, row.path_file), 'utf8');

        mail.traitementMail(eml).then((mail_content) => {
          let html = mail.constructionMail(mail_content, data, uid);
          event.sender.send('mail_return', html);
        })
      });
    })
  }
});

// Envoi l'eml du mail dont l'id est passé en paramètre
ipcMain.on('eml_read', (event, uid) => {
  if (uid != null) {
    db.db_mail_select(uid).then((row) => {

      let eml = fs.readFileSync(path.join(process.env.PATH_ARCHIVE, row.path_file), 'utf8');

      event.sender.send('eml_return', eml);
    });
  }
});

// Envoi la pièce jointe sélectionné
ipcMain.on('attachment_select', (event, value) => {
  db.db_attachment_select(value).then((row) => {
    let eml = fs.readFileSync(path.join(process.env.PATH_ARCHIVE, row.path_file), 'utf8');

    mail.traitementAttachment(eml, value.partid)
      .then((result) => {
        const options = {
          title: "Enregistrer un fichier",
          defaultPath: path.join(app.getPath('downloads'), result.filename),
        }
        dialog.showSaveDialog(null, options).then(response => {
          fs.writeFileSync(response.filePath, result.content, (err) => {
            if (err) throw err;
          })
          shell.openPath(response.filePath);
        });
      })
  })
})

process.env.ARRET_ARCHIVAGE = 0;
//Arrêt de l'archivage avec le plugin mel_electron
ipcMain.on('stop-archivage', (events, data) => {
  process.env.ARRET_ARCHIVAGE = 1;
});

// Téléchargement des mails avec le plugin mel_archivage 
ipcMain.on('download_eml', (events, data) => {
  //On récupère le token pour le téléchargement des mails
  let token = data.token;

  //Si une liste de téléchargement est envoyée on réécrit dans le fichier, sinon on le lit pour finir l'archivage précédent
  if (data.files) {
    fs.writeFileSync(process.env.PATH_LISTE_ARCHIVE, JSON.stringify(data.files));
  }
  if (fs.existsSync(process.env.PATH_LISTE_ARCHIVE)) {
    //On récupère les données de l'archivage
    let file_data = JSON.parse(fs.readFileSync(process.env.PATH_LISTE_ARCHIVE))
    if (file_data.length > 0) {
      let copy_files = [...file_data];
      let path_folder;
      if (file_data.length > 0) {
        events.sender.send('download-advancement', { "length": file_data.length });
        let file = file_data.pop();
        path_folder = functions.createFolderIfNotExist(file.path_folder)
        try {
          download(events.sender, path.join(process.env.LOAD_PATH, file.url.concat(`&_token=${token}`)), { directory: path_folder })
        } catch (error) {
          console.log('Erreur de téléchargement');
        }
      }
      else {
        events.sender.send('download-finish');
      }
      session.defaultSession.on('will-download', (event, item, webContents) => {
        item.on('done', (event, state) => {
          if (state === 'completed') {
            let uid = new URLSearchParams(item.getURL()).get('_uid');
            let file = copy_files.find((post) => {
              if (post.uid == uid) {
                return true;
              }
            })
            functions.traitementColsFile(item.getSavePath()).then(element => {
              element.etiquettes = JSON.stringify(file.etiquettes);
              db.db_insert_archive(element);
            });
            events.sender.send('download-advancement', { "length": file_data.length, "uid": file.uid, "mbox": file.mbox });
            if (file_data.length > 0) {
              //Si on arrête l'archivage
              if (process.env.ARRET_ARCHIVAGE != 0) {
                process.env.ARRET_ARCHIVAGE = 0;
                file_data = [];
                fs.writeFileSync(process.env.PATH_LISTE_ARCHIVE, JSON.stringify(file_data));
                events.sender.send('download-finish');
                session.defaultSession.removeAllListeners();
              }
              else {
                fs.writeFileSync(process.env.PATH_LISTE_ARCHIVE, JSON.stringify(file_data));
                let file = file_data.pop();
                try {
                  download(events.sender, path.join(process.env.LOAD_PATH, file.url.concat(`&_token=${token}`)), { directory: path_folder })
                } catch (error) {
                  console.log('Erreur de téléchargement');
                }
              }
            }
            else {
              fs.writeFileSync(process.env.PATH_LISTE_ARCHIVE, JSON.stringify(file_data));
              events.sender.send('download-finish');
              session.defaultSession.removeAllListeners();
            }
          } else {
            console.log(`Téléchargement échoué : ${state}`)
          }
        })
      })
    }
  }
});

ipcMain.on('delete_selected_mail', (events, uids) => {
  try {
    db.db_get_path(uids).then((rows) => {
      rows.forEach(row => {
        fs.unlinkSync(path.join(process.env.PATH_ARCHIVE, row.path_file));
        db.db_delete_selected_mail(row.id);
      });
    })
  }
  catch (err) { console.log(err) }
})

ipcMain.on('read_unread', (events, etiquettes) => {
  let uid = etiquettes.uid
  delete etiquettes.uid;
  db.db_update_etiquettes(uid, JSON.stringify(etiquettes));
});

ipcMain.on('flag_unflagged', (events, etiquettes) => {
  let uid = etiquettes.uid
  delete etiquettes.uid;
  db.db_update_etiquettes(uid, JSON.stringify(etiquettes));
});