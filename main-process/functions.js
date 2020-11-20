const { BrowserWindow } = require('electron');
const mail = require('./mail.js');
const utf7 = require('utf7').imap;
const path = require('path');
const fs = require('fs');
const log4js = require("log4js");
const logger = log4js.getLogger("functions");

module.exports = {
  createFolderIfNotExist(mbox) {
    try {
      mbox = utf7.decode(mbox);
      let path_folder = path.join(process.env.PATH_ARCHIVE, mbox);
      if (!fs.existsSync(path_folder)) {
        fs.mkdirSync(path_folder, { recursive: true });
        BrowserWindow.getAllWindows()[0].send('new_folder');
      }
      return path_folder;
    } catch (err) { logger.error(err) }
  },

  traitementColsFile(file) {
    return new Promise((resolve) => {
      try {
        new Promise((resolve) => {
          fs.readFile(file, 'utf8', (err, eml) => {
            if (err) logger.error(err);
            resolve(eml);
          });
        }).then((eml) => {
          resolve(mail.traitementCols(eml, file));
        })
      }
      catch (err) { logger.error(err) }
    });
  },

  getSubfolder(path) {
    path = path.replace(/\\/g, "/");
    path = path.split(process.env.ARCHIVE_FOLDER + '/');
    let subfolder = path.pop();
    subfolder = subfolder.split('/');
    subfolder.pop();
    return subfolder.join('/');
  },

  getSubfolderFile(path) {
    path = path.replace(/\\/g, "/");
    path = path.split(process.env.ARCHIVE_FOLDER + '/');
    let subfolder = path.pop();
    subfolder = subfolder.split('/');
    return subfolder.join('/');
  },

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'Ko', 'Mo', 'Go', 'To', 'Po', 'Eo', 'Zo', 'Yo'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },
}

