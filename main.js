const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('fs');
const path = require('path');
const emlformat = require('eml-format');

app.commandLine.appendSwitch('ignore-certificate-errors');

let mails = [];

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

app.on("ready", createWindow);

ipcMain.on('read_mail_dir', (event, msg) => {
  dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  }).then(result => {
    let cols = [];
    let path = result.filePaths[0];
    fs.readdir(path, (err, files) => {
      files.forEach(file => {
        let eml = fs.readFileSync(path + '/' + file, 'utf8');
        emlformat.read(eml, function (error, data) {
          if (error) return console.log(error);
          fs.writeFileSync("sample.json", JSON.stringify(data, " ", 2));
          let date = new Date(data.date);
          let date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' })
          let from = emlformat.getEmailAddress(emlformat.unquotePrintable(data.from.email));
          let col = { "subject": data.subject, "fromto": from.email, "date": date_fr };
          cols.push(col);
          mails.push(data);
        });
      });
      win.webContents.send('mail_dir', cols) // send to web page

    });
  })
})


ipcMain.on('mail_select', (event, uid) => {

  fs.readFile('template/messagepreview.html', (err, data) => {
    if (err) {
      console.error(err)
      return
    }

    let from = "";
    let mail = mails[uid];
    let html = data.toString();
    html = html.replace("%%SUBJECT%%", mail.subject);
    from = emlformat.getEmailAddress(emlformat.unquotePrintable(mail.from.email));
    html = html.replace("%%FROM%%", from.email);

    html = html.replace("%%DATE%%", mail.date.toLocaleString('fr-FR', { timeZone: 'UTC' }));
    if (mail.html != undefined) {
      html = html.replace("%%OBJECT%%", mail.html);
    }
    else {
      html = html.replace("%%OBJECT%%", mail.text);
    }

    win.webContents.send('mail_return', html);
  })
});
