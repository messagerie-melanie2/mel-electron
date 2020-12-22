const { dialog, ipcMain } = require('electron');
const DecompressZip = require('decompress-zip');
const functions = require('./functions.js');
const db = require('./database.js');
const path = require("path")

ipcMain.on('import-archivage', (event) => {
    zipDecompress(event);
});


function zipDecompress(event) {
    dialog.showOpenDialog({
        title: "Sélectionner votre archive à décompresser",
        properties: ['multiSelections'],
        filters: [
            { name: '.ZIP Files', extensions: ['zip'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    }).then(result => {
        if (!result.canceled) {
            for (let i = 0; i < result.filePaths.length; i++) {
                //On retrouve le chemin de l'archive
                let zip_array = result.filePaths[i].replace('.zip', '').split('/').pop().split('-');
                let zip_account = zip_array[1];
                let zip_folders;
                if (zip_array.length < 3) {
                    zip_folders = ["INBOX"]
                }
                else {
                    let zip_folder = zip_array[2].replace(/ \([0-9]+\)/g, '');
                    zip_folders = zip_folder.split('_');
                }

                let pathOutput = path.join(process.env.PATH_ARCHIVE, path.join(zip_account, zip_folders.join(path.sep)))

                var unzipper = new DecompressZip(result.filePaths[i]);


                unzipper.extract({
                    path: pathOutput,
                });

                unzipper.on('progress', function (fileIndex, fileCount) {
                    let files = fileCount - fileIndex;
                    if (files < 1) {
                        event.sender.send('import-advancement', files);
                    }
                    else {
                        event.sender.send('import-finish');
                    }
                });
                unzipper.on('extract', function (log) {
                    for (let j = 0; j < log.length; j++) {
                        const file = log[j].deflated;
                        let filePath = path.join(pathOutput, file)
                        insertEmlBdd(event, filePath);
                    }
                });
                unzipper.on('error', function (err) {
                    console.log('Caught an error', err);
                    dialog.showMessageBox(null, {
                        type: 'error',
                        title: 'Erreur',
                        message: "Erreur lors de l'importation de l'archive",
                    });
                })
            }
        }
    }).catch(err => {
        console.log(err)
    })
}

function insertEmlBdd(event, filePath) {
    functions.traitementColsFile(filePath).then(element => {
        element.etiquettes = '{"SEEN":false}';
        db.db_insert_archive_promise(element).then(() => {
            event.sender.send('new_folder');
        });
    });
}