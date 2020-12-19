const DecompressZip = require('decompress-zip');
const glob = require("glob")
const path = require("path")
const fs = require("fs")
const functions = require('./functions.js');
const db = require('./database.js');

zipDecompress()
function zipDecompress() {
    readDir(process.env.PATH_ARCHIVE + '/*.zip').then((zip_files) => {
        if (zip_files.length) {
            for (let i = 0; i < zip_files.length; i++) {
                //On retrouve le chemin de l'archive
                let zip = zip_files[i].split('/').pop().split('-');
                let zip_account = zip[1];
                let zip_folder = zip[2].replace('.zip', '');
                let zip_folders = zip_folder.split('_');

                let zip_path = path.join(process.env.PATH_ARCHIVE, path.join(zip_account, zip_folders.join(path.sep)))

                var unzipper = new DecompressZip(zip_files[i]);

                
                unzipper.extract({
                    path: zip_path,
                });
                unzipper.on('extract', function (log) {
                    unzipper.list();
                    unzipper.on('list', function (files) {
                        for (let j = 0; j < files.length; j++) {
                            const file = files[j];
                            let file_path = path.join(zip_path, file)
                            functions.traitementColsFile(file_path).then(element => {
                                element.etiquettes = '{"SEEN":false}';
                                db.db_insert_archive(element);
                            });
                            fs.unlinkSync(zip_files[i])
                        }
                    });
                    
                });
            }
        }
        else {
            reject('Pas de zip');
        }
    });
}


function readDir(path) {
    return new Promise((resolve) => {
        glob(path, (err, files) => {
            resolve(files);
        });
    });
}