const mail = require('./mail.js');
const utf7 = require('utf7').imap;
const path = require('path');
const fs = require('fs');

module.exports = {
  createFolderIfNotExist(mbox) {
    mbox = utf7.decode(mbox);
    let path_folder = path.join(process.env.PATH_ARCHIVE, mbox);
    if (!fs.existsSync(path_folder)) {
      fs.mkdirSync(path_folder, { recursive: true });
    }
    return path_folder;
  },

  traitementColsFiles(files) {
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
              promises.push(mail.traitementCols(eml, file));
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
  },

  getSubfolder(path) {
    path = path.replace(/\\/g, "/");
    path = path.split('Mails Archive/');
    let subfolder = path.pop();
    subfolder = subfolder.split('/');
    subfolder.pop();
    return subfolder.join('/');
  },

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'Ko', 'Mo', 'Go', 'To', 'Po', 'Eo', 'Zo', 'Yo'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}