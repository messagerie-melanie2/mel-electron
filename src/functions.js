const fs = require('fs');
const path = require('path');

module.exports = {
    getMostRecentFile(dir) {
        const files = orderReccentFiles(dir);
        return files.length ? files[0] : undefined;
    },

    isEmpty(path) {
        return fs.readdirSync(path).length === 0;
    },
    
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
      
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'Ko', 'Mo', 'Go', 'To', 'Po', 'Eo', 'Zo', 'Yo'];
      
        const i = Math.floor(Math.log(bytes) / Math.log(k));
      
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
      }
      
}

function orderReccentFiles(dir) {
    return fs.readdirSync(dir)
        .filter(file => fs.lstatSync(path.join(dir, file)).isFile())
        .map(file => ({ file, mtime: fs.lstatSync(path.join(dir, file)).mtime }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
};