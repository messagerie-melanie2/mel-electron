const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('fs');
const path = require('path');
const emlformat = require('eml-format');

app.commandLine.appendSwitch('ignore-certificate-errors');

let mails = [];
let cols = [];

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

    let path = result.filePaths[0];
    fs.readdir(path, (err, files) => {
      mails = [];
      files.forEach(file => {
        let eml = fs.readFileSync(path + '/' + file, 'utf8');
        emlformat.read(eml, function (error, data) {
          if (error) return console.log(error);
          fs.writeFileSync("sample.json", JSON.stringify(data, " ", 2));
          let date = new Date(data.date);
          let date_fr = date.toLocaleString('fr-FR')
          let from = emlformat.getEmailAddress(emlformat.unquotePrintable(data.from.email));

          let from_name;
          (from.name == undefined) ? from_name = data.from.name : from.name;
          
          let from_email;
          (from.email == undefined) ? from_email = from[1].email : from_email = from.email;
          
          (from_name == undefined) ? from_name = from[1].name : "";
          let col = { "subject": data.subject.replace(/_/g, ' '), "fromto": from_email, "date": date_fr, "name": from_name.replace(/_/g, ' ')};
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

    let mail = mails[uid];    
    let col = cols[uid];
    
    let html = data.toString();
    html = html.replace("%%SUBJECT%%", col.subject);
    html = html.replace("%%FROM_NAME%%", col.name);
    html = html.replace("%%FROM%%", col.fromto);
    html = html.replace("%%TO%%", mail.to.email);
    html = html.replace("%%DATE%%", col.date);
    (mail.html != undefined) ? html = html.replace("%%OBJECT%%", mail.html) : html = html.replace("%%OBJECT%%", ('<pre style="white-space: pre-line;">' + mail.text + '</pre>'));

    win.webContents.send('mail_return', html);
  })
});
