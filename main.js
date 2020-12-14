const { autoUpdater } = require("electron-updater")
const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const glob = require('glob')
const fs = require('fs')
const log4js = require("log4js");
// const logger = log4js.getLogger("main");
const {version} = require("./package.json");

// log4js.configure({
//   appenders: {
//     everything: { type: 'file', filename: 'logs/logs.log', maxLogSize: 10485760, backups: 3, compress: true }
//   },
//   categories: {
//     default: { appenders: ['everything'], level: 'debug' }
//   }
// });

// logger.info("Démarrage de l'application")

require('dotenv').config({ path: path.join(process.resourcesPath, '.env') })
// require('dotenv').config()

if (!process.env.PATH_ARCHIVE) {
  process.env.PATH_ARCHIVE = path.join(app.getPath("userData"), process.env.ARCHIVE_FOLDER)
}
else {
  process.env.PATH_ARCHIVE = path.join(process.env.PATH_ARCHIVE, process.env.ARCHIVE_FOLDER)
}
process.env.PATH_DB = path.join(app.getPath("userData"), 'archivage_mails.db');
process.env.PATH_LISTE_ARCHIVE = path.join(process.env.PATH_ARCHIVE, 'liste_archivage.json');
process.env.APPLICATION_VERSION = version;

let mainWindow = null
app.commandLine.appendSwitch('ignore-certificate-errors')

function initialize() {
  loadApp();

  function createWindow() {
    const WindowOptions = {
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.resolve(`${__dirname}/src/preload.js`),
      }
    }

    mainWindow = new BrowserWindow(WindowOptions);

    try {
      mainWindow.loadURL(process.env.LOAD_PATH, { userAgent: 'Mel_Electron V.' + process.env.npm_package_version })
    }
    catch {
      // logger.error("Problème d'url lors du chargement de l'application")
      dialog.showMessageBox(null, {
        type: 'error',
        title: 'Erreur',
        message: "Erreur lors du chargement de Mél",
      });
    }
    mainWindow.maximize()

    mainWindow.on('closed', () => {
      // logger.info("Arrêt de l'application")
      log4js.shutdown
      mainWindow = null
    })
  }

  app.on('ready', () => {
    autoUpdater.checkForUpdatesAndNotify();
    createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow()
    }
  })
}

//--------------------------------------------------------------------------------------------------
// Auto updates
//--------------------------------------------------------------------------------------------------
const sendStatusToWindow = (text) => {
  // logger.info(text);
  if (mainWindow) {
    mainWindow.webContents.send('message', text);
  }
};

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Recherche de mise à jour...');
})
autoUpdater.on('update-available', () => {
  sendStatusToWindow('Mise à jour disponible');
})
autoUpdater.on('update-not-available', () => {
  sendStatusToWindow('Pas de mise à jour disponible');
})
autoUpdater.on('error', err => {
  sendStatusToWindow(`Erreur de la mise à jour automatique ${err.toString()}`);
})


// Require each JS file in the main-process dir
function loadApp() {
  const files = glob.sync(path.join(__dirname, 'main-process/*.js'))
  files.forEach((file) => { require(file) })
}

function createArchiveFolder() {
  if (!fs.existsSync(process.env.PATH_ARCHIVE)) {
    fs.mkdirSync(process.env.PATH_ARCHIVE)
  }
}

initialize()
createArchiveFolder()