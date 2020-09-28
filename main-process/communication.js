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

// Envoi la liste des sous-dossier dans le dossier 'Mails archive' au plugin electron  
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

// Envoi la liste des mails d'un dossier au plugin electron  
ipcMain.on('read_mail_dir', (event, path) => {
  db.db_read_mail_dir(path).then((value) => {
    event.sender.send('mail_dir', value)
  });
})

// Envoi le mail sélectionné au plugin electron 
ipcMain.on('mail_select', (event, uid) => {
  if (uid != null) {
    const template = (process.env.DEV_MODE == "Dev") ? 'template/messagepreview.html' : path.join(process.resourcesPath, 'template/messagepreview.html');
    fs.readFile(template, (err, data) => {
      if (err) {
        console.error(err)
        return
      }

      db.db_mail_select(uid).then((row) => {

        let eml = fs.readFileSync(row.path_file, 'utf8');

        mail.traitementMail(eml).then((mail_content) => {
          let html = mail.constructionMail(mail_content, data, uid);
          event.sender.send('mail_return', html);
        })
      });
    })
  }
});

// Envoi la pièce jointe sélectionné au plugin electron
ipcMain.on('attachment_select', (event, value) => {

  db.db_attachment_select(value).then((row) => {
    let eml = fs.readFileSync(row.path_file, 'utf8');

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


// Téléchargement des mails avec le plugin mel_archivage 
ipcMain.on('download_eml', (events, files) => {
  let copy_files = [...files];
  events.sender.send('download-count', files.length);
  let path_folder;
  if (files.length > 0) {
    let file = files.pop();
    path_folder = functions.createFolderIfNotExist(file.mbox)
    download(BrowserWindow.getAllWindows()[0], path.join(process.env.LOAD_PATH, file.url), { directory: path_folder })
  }
  else {
    console.log('Dossier vide');
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
        console.log(files.length);
        events.sender.send('download-count', files.length);
        if (files.length > 0) {
          let file = files.pop();
          download(BrowserWindow.getAllWindows()[0], path.join(process.env.LOAD_PATH, file.url), { directory: path_folder })
        }
        else {
          events.sender.send('download-finish', copy_files);
          session.defaultSession.removeAllListeners();
        }
      } else {
        console.log(`Téléchargement échoué : ${state}`)
      }
    })
  })
});
