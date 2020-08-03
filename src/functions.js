const fs = require('fs');
const path = require('path');
const glob = require("glob");
_ = require('underscore');

module.exports = {

    getLastModifiedFolder(path) {
        let stats = [];
        getDirectoriesRecursive(path).forEach((folder) => {
            stats.push(fs.statSync(path).mtime.getTime());
        })
        return _.max(stats);
    },

    getLastModifiedFile(path) {
        let stats = [];
        glob.sync(path + '/**/*.eml').forEach((file) => {
            stats.push(fs.statSync(file).mtime.getTime())
        })
        return _.max(stats);
    },

    isEmpty(path) {
        return fs.readdirSync(path).length === 0;
    },

    inParam(sql, arr) {
        return sql.replace('?#', arr.map(() => '?').join(','))
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


function flatten(lists) {
    return lists.reduce((a, b) => a.concat(b), []);
}

function getDirectories(srcpath) {
    return fs.readdirSync(srcpath)
        .map(file => path.join(srcpath, file))
        .filter(path => fs.statSync(path).isDirectory());
}

function getDirectoriesRecursive(srcpath) {
    return [srcpath, ...flatten(getDirectories(srcpath).map(getDirectoriesRecursive))];
}