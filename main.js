const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('fs');
const path = require('path');
const emlformat = require('eml-format');
const simpleParser = require('mailparser').simpleParser;

var MailParser = require("mailparser").MailParser;


app.commandLine.appendSwitch('ignore-certificate-errors');

let cols = [];
let promises = [];

let win;

async function createWindow() {

  // Create the browser window.
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false, // is default value after Electron v5
      contextIsolation: true, // protect against prototype pollution
      enableRemoteModule: false, // turn off remote
      preload: path.resolve(`${__dirname}/src/preload.js`),
    }
  });
  win.maximize();
  win.webContents.loadURL('https://roundcube.ida.melanie2.i2');

  // win.webContents.openDevTools();
}

let i = -1;
app.on("ready", createWindow);

ipcMain.on('read_mail_dir', (event, msg) => {
  dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  }).then(result => {
    let path = result.filePaths[0];
    fs.readdir(path, (err, files) => {
      files.forEach(file => {
        let path_file = path + '/' + file;
        let eml = fs.readFileSync(path_file, 'utf8');
        i++;
        promises.push(traitementMails(eml, i, path_file))
      });
      Promise.all(promises)
        .then((result) => {
          cols = result;
          win.webContents.send('mail_dir', result) // send to web page
        }).catch((e) => { })
    });
  })
})

function traitementMails(eml, i, path_file) {
  return new Promise((resolve) => {
    simpleParser(eml)
      .then(parsed => {
        let date = new Date(parsed.date);
        let date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' })
        resolve({ "id": i, "subject": parsed.subject, "fromto": parsed.from.value[0].address, "date": date_fr, "name": parsed.from.value[0].name, "to": parsed.to.value[0].address, "path_file": path_file });
      })
      .catch(err => { });
  })
}


ipcMain.on('mail_select', (event, uid) => {
  fs.readFile('template/messagepreview.html', (err, data) => {
    if (err) {
      console.error(err)
      return
    }

    let promise1 = [];
    let mail = cols[uid];
    let eml = fs.readFileSync(mail.path_file, 'utf8');

    promise1.push(traitementBody(eml));

    Promise.all(promise1)
      .then((result) => {
        let html = data.toString();
        html = html.replace("%%SUBJECT%%", mail.subject);
        html = html.replace("%%FROM_NAME%%", mail.name);
        html = html.replace("%%FROM%%", mail.fromto);
        html = html.replace("%%TO%%", mail.to);
        html = html.replace("%%DATE%%", mail.date);
        html = html.replace("%%OBJECT%%", object);
        win.webContents.send('mail_return', html);
      }).catch((e) => { })
  })
});

function traitementBody(eml) {
  return new Promise((resolve) => {
    var mailparser = new MailParser();
    mailparser.on("data", function (mail_object) {
      if (mail_object.type === 'attachment') {
        mail_object.content.pipe(process.stdout);
        mail_object.content.on('end', () => mail_object.release());
      }
      if (mail_object.type === 'text') {
        (mail_object.html == undefined) ? object = mail_object.textAsHtml : object = mail_object.html;
        resolve(object)
      }
    });
    mailparser.write(eml);
    mailparser.end();
  })
}