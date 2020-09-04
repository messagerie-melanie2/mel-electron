
const {
    contextBridge,
    ipcRenderer
} = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "api", {
    send: (channel, data) => {
        // whitelist channels
        let validChannels = ["read_mail_dir", "mail_select", "attachment_select", "subfolder", "download_eml"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        let validChannels = ["mail_dir", "mail_return", "busy-loader", "listSubfolder"];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 

            ipcRenderer.on(channel, (event, ...args) => func(...args));

        }
    }
}
);