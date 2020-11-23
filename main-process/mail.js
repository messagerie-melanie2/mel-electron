const MailParser = require("mailparser").MailParser;
const simpleParser = require('mailparser').simpleParser;
const functions = require('./functions.js');

module.exports = {

  // Parsage du mail pour récupérer les infos 
  traitementMail(eml) {
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
        mail_content.contentType = headers.get('content-type');
      });
      mailparser.on("data", function (mail_object) {
        if (mail_object.type === 'attachment') {
          let bufs = [];
          let attachment_content = [];

          attachment_content['contentDisposition'] = mail_object.contentDisposition;

          attachment_content['cid'] = mail_object.cid;
          attachment_content['ctype'] = mail_object.contentType;
          attachment_content['filename'] = mail_object.filename;
          attachment_content['partid'] = mail_object.partId;


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
  },

  // Assemblage du mail et du html 
  constructionMail(result, data, uid) {
    let to = "";
    let cc = "";
    let i = 0;
    let surplusTo = [];
    let surplusCc = [];
    let html = data.toString();

    html = html.replace("%%SUBJECT%%", result.subject);
    html = html.replace("%%FROM_NAME%%", result.from.value[0].name);
    html = html.replace("%%FROM%%", result.from.value[0].address);

    let virgule = "";
    to = '<tr><td class="header-title">À</td><td class="header to">';
    result.to.value.forEach(value => {
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


    if (result.cc != undefined) {
      i = 0;
      cc = '<tr><td class="header-title">Cc</td><td class="header cc">';
      virgule = "";
      result.cc.value.forEach(value => {
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

    let date = new Date(result.date);
    let date_fr = date.toLocaleString('fr-FR', { timeZone: 'UTC' })
    html = html.replace("%%DATE%%", date_fr);

    // const regex = /(<style(.*?)*)(\n.*?)*<\/style>/;
    html = html.replace("%%OBJECT%%", result.object);
    // html = html.replace("%%OBJECT%%", result.object.replace(regex, ""));

    //Traitement des pièces jointes
    if (result.attachments != []) {
      result.attachments.forEach(element => {
        if (element['contentDisposition'] != "attachment") {
          html = html.replace('cid:' + element['cid'], "data:" + element['ctype'] + ";base64, " + element['buf'].toString('base64'));
        }
        else {
          let filename = element['filename'];
          let ctype = element['ctype'].split('/');
          // let size = " (~" + functions.formatBytes(element['buf'].toString().length, 0) + ")";

          html = html.replace('style="display: none;"', '');
          html = html.replace('%%ATTACHMENT%%', "<li id='attach2' class='application " + ctype[1] + "'><a href='#' onclick='openAttachment(" + uid + "," + element["partid"] + ")' id='attachment' title='" + filename  + "'>" + filename + "</a></li>%%ATTACHMENT%%");
        }
      })
    }

    html = html.replace('%%ATTACHMENT%%', '');
    return html;
  },

  // Parsage du mail pour récupérer les pièces jointes 
  traitementAttachment(eml, partid) {
    return new Promise((resolve) => {
      simpleParser(eml, (err, parsed) => {
        if (parsed.attachments) {
          parsed.attachments.forEach((attachment) => {
            if (attachment.partId == partid) {
              resolve(attachment);
            }
          })
        }
      });
    })
  },

  // Traitement des mails pour récupérer infos utiles 
  traitementCols(eml, path_file) {
    return new Promise((resolve) => {
      let subject = "";
      let from = "";
      let content_type = "";
      let mailparser = new MailParser();
      mailparser.on("headers", function (headers) {
        subject = headers.get('subject');
        from = headers.get('from');
        content_type = headers.get('content-type').value;
        let date_fr = new Date(headers.get('date').getTime());
        try {
          resolve({ "subject": subject, "fromto": from.value[0].name, "date": date_fr, "path_file": path_file, "break": 0, "content_type": content_type });
        }
        catch (error) {
          resolve({ "subject": "", "fromto": "", "date": "", "path_file": "", "break": 1, "content_type": "" });
        };
      });
      mailparser.write(eml);
      mailparser.end();
    })
  }
}