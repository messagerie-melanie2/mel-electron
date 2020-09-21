const { app, BrowserWindow } = require('electron');
const path = require('path')
const glob = require('glob')
require('dotenv').config()
const fs = require('fs');

process.env.PATH_ARCHIVE = path.join(app.getPath("userData"), 'Mails Archive');

let mainWindow = null

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
    mainWindow.loadURL(process.env.LOAD_PATH, { userAgent: 'Mel_Electron V.' + process.env.VERSION_BUILD });

    mainWindow.on('closed', () => {
      mainWindow = null
    })
  }

  app.on('ready', () => {
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

// Require each JS file in the main-process dir
function loadApp() {
  const files = glob.sync(path.join(__dirname, 'main-process/*.js'))
  files.forEach((file) => { require(file) })
}

//Création du dossier d'archive des mails si il n'existe pas
function createArchiveFolder() {
  if (!fs.existsSync(process.env.PATH_ARCHIVE)) {
    fs.mkdirSync(process.env.PATH_ARCHIVE);
  }
}

initialize();
createArchiveFolder();