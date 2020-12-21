const { dialog, ipcMain } = require('electron');
const DecompressZip = require('decompress-zip');
const glob = require("glob")
const path = require("path")
const fs = require("fs")
const functions = require('./functions.js');
const db = require('./database.js');



ipcMain.on('import-archivage', (event, msg) => {
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
                let zip = result.filePaths[i].split('/').pop().split('-');
                let zip_account = zip[1];
                let zip_folder = zip[2].replace(/ \([0-9]+\)/g, '').replace('.zip', '');
                let zip_folders = zip_folder.split('_');

                let zip_path = path.join(process.env.PATH_ARCHIVE, path.join(zip_account, zip_folders.join(path.sep)))

                var unzipper = new DecompressZip(result.filePaths[i]);


                unzipper.extract({
                    path: zip_path,
                });
                unzipper.on('extract', function (log) {
                    for (let j = 0; j < log.length; j++) {
                        const file = log[j].deflated;
                        let file_path = path.join(zip_path, file)
                        functions.traitementColsFile(file_path).then(element => {
                            element.etiquettes = '{"SEEN":false}';
                            db.db_insert_archive_promise(element).then(() => {
                                event.sender.send('new_folder');
                            });
                        });
                    }
                });
            }
        }
    }).catch(err => {
        console.log(err)
    })

    // fs.unlinkSync(result.filePaths[i])
}