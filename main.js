const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('fs');
const path = require('path');
const emlformat = require('eml-format');
const simpleParser = require('mailparser').simpleParser;

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
        let eml = fs.readFileSync(path + '/' + file, 'utf8');
        i++;
        promises.push(traitementMails(eml, i))
      });
      Promise.all(promises)
        .then((result) => {
          cols = result;
          console.log(cols);
          win.webContents.send('mail_dir', result) // send to web page
        }).catch((e) => { })
    });
  })
})

function traitementMails(eml, i) {
  return new Promise((resolve) => {
    simpleParser(eml)
      .then(parsed => {
        let date = new Date(parsed.date);
        let date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' })
        resolve({ "id": i, "subject": parsed.subject, "fromto": parsed.from.value[0].address, "date": date_fr, "name": parsed.from.value[0].name, "to": parsed.to.value[0].address, "text": parsed.textAsHtml});
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

    let mail = cols[uid];

    let html = data.toString();
    html = html.replace("%%SUBJECT%%", mail.subject);
    html = html.replace("%%FROM_NAME%%", mail.name);
    html = html.replace("%%FROM%%", mail.fromto);
    html = html.replace("%%TO%%", mail.to);
    html = html.replace("%%DATE%%", mail.date);
    html = html.replace("%%OBJECT%%", mail.text)
    // (mail.html != undefined) ? html = html.replace("%%OBJECT%%", mail.html) : html = html.replace("%%OBJECT%%", ('<pre style="white-space: pre-line;">' + mail.text + '</pre>'));

    win.webContents.send('mail_return', html);
  })
});
