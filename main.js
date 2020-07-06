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
        promises.push(traitementCols(eml, i, path_file))
      });
      Promise.all(promises)
        .then((result) => {
          cols = result;
          win.webContents.send('mail_dir', result) // send to web page
        }).catch((e) => { })
    });
  })
})


ipcMain.on('mail_select', (event, uid) => {
  fs.readFile('template/messagepreview.html', (err, data) => {
    if (err) {
      console.error(err)
      return
    }

    let promise1 = [];

    let mail = cols[uid];
    let eml = fs.readFileSync(mail.path_file, 'utf8');

    promise1.push(traitementMail(eml));

    Promise.all(promise1)
      .then((mail_content) => {
        let html = constructionMail(mail_content, data);
        win.webContents.send('mail_return', html);
      }).catch((e) => { })
  })
});



//Parsage du mail pour afficher la liste
function traitementCols(eml, i, path_file) {
  return new Promise((resolve) => {
    simpleParser(eml)
      .then(parsed => {
        let date = new Date(parsed.date);
        let date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' })
        resolve({ "id": i, "subject": parsed.subject, "fromto": parsed.from.value[0].address, "date": date_fr, "path_file": path_file });
      })
      .catch(err => { });
  })
}

//Parsage du mail pour récupérer les infos
function traitementMail(eml) {
  return new Promise((resolve) => {
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
        mail_object.content.pipe(process.stdout);
        mail_object.content.on('end', () => mail_object.release());
      }
      if (mail_object.type === 'text') {
        (mail_object.html == undefined) ? object = mail_object.textAsHtml : object = mail_object.html;
        mail_content.object = object;
        resolve(mail_content);
      }
    });
    mailparser.write(eml);
    mailparser.end();
  })
}

//Assemblage du mail et du html
function constructionMail(result, data) {
  let to = "";
  let cc = "";
  let i = 0;
  let surplusTo = [];
  let surplusCc = [];
  let html = data.toString();

  html = html.replace("%%SUBJECT%%", result[0].subject);
  html = html.replace("%%FROM_NAME%%", result[0].from.value[0].name);
  html = html.replace("%%FROM%%", result[0].from.value[0].address);

  let virgule = "";
  to = '<tr><td class="header-title">À</td><td class="header to">';
  result[0].to.value.forEach(value => {
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


  if (result[0].cc != undefined) {
    i = 0;
    cc = '<tr><td class="header-title">Cc</td><td class="header cc">';
    virgule = "";
    result[0].cc.value.forEach(value => {
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

  let date = new Date(result[0].date);
  let date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' })
  html = html.replace("%%DATE%%", date_fr);

  html = html.replace("%%OBJECT%%", result[0].object);

  return html;
}