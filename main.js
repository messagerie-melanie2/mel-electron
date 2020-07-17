const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const fs = require('fs');
const path = require('path');
const simpleParser = require('mailparser').simpleParser;
let MailParser = require("mailparser").MailParser;
const shell = require('electron').shell;

app.commandLine.appendSwitch('ignore-certificate-errors');

let cols = [];
let promises = [];

let win;

function createWindow() {

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
}
let i = -1;
app.on("ready", createWindow);


ipcMain.on('attachment_select', (event, uid) => {
  let mail = cols[uid];
  let eml = fs.readFileSync(mail.path_file, 'utf8');

  let promise = traitementAttachment(eml);

  promise.then((result) => {
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

    let promise = [];

    let mail = cols[uid];
    let eml = fs.readFileSync(mail.path_file, 'utf8');

    promise.push(traitementMail(eml));

    Promise.all(promise)
      .then((mail_content) => {
        let html = constructionMail(mail_content, data, uid);
        win.webContents.send('mail_return', html);
      }).catch((e) => { })
  })
});

//Parsage du mail pour afficher dans la liste
function traitementCols(eml, i, path_file) {
  return new Promise((resolve) => {
    let subject = ""; 
    let from = ""; 
    let date_fr = ""; 
    let mailparser = new MailParser();
    mailparser.on("headers", function (headers) {
      subject = headers.get('subject');
      from = headers.get('from');
      let date = new Date(headers.get('date'));
      date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' })
      resolve({ "id": i, "subject": subject, "fromto": from.value[0].name, "date": date_fr, "path_file": path_file });
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
        attachment_content['size'] = mail_object.size;

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
        attachment_content.size = mail_object.size;

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

  const regex = /(<style(.*?)*)(\n.*?)*<\/style>/;
  html = html.replace("%%OBJECT%%", result[0].object.replace(regex, ""));

  //Traitement des pièces jointes
  // console.log(result[0]);

  if (result[0].attachments != []) {
    result[0].attachments.forEach(element => {
      if (element['contentDisposition'] == "inline") {
        html = html.replace('cid:' + element['cid'], "data:" + element['ctype'] + ";base64, " + element['buf'].toString('base64'));
      }
      else {
        let filename = element['filename'];
        let size = (element['size'] != undefined) ? '(~' + element['size'] + ')' : "";
        let ctype = element['ctype'].split('/');

        html = html.replace('style="display: none;"', '');
        html = html.replace('%%ATTACHMENT%%', "<li id='attach2' class='application " + ctype[1] + "'><a href='#' onclick='openAttachment(" + uid + ")' id='attachment' title='" + filename + "'>" + filename + "<span class='attachment-size'>" + size + "</span></a></li>%%ATTACHMENT%%");
      }
    })
  }

  html = html.replace('%%ATTACHMENT%%', '');
  return html;
}