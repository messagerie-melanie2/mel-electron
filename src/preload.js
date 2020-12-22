
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
        let validChannels = ["read_mail_dir", "mail_select", "eml_read", "attachment_select", "subfolder", "download_eml", "get_archive_folder", "search_list", "read_unread", "flag_unflagged", "stop-archivage", "delete_selected_mail", "import-archivage"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        if (channel != undefined) {

            let validChannels = ["mail_dir", "mail_return", "eml_return", "listSubfolder", "download-finish", "download-advancement", "archive_folder", "new_folder", "add_message_row", "result_search", "import-advancement", "import-finish"];
            if (validChannels.includes(channel)) {
                // Deliberately strip event as it includes `sender` 

                try {
                    ipcRenderer.on(channel, (event, ...args) => func(...args));
                } catch (error) {
                    console.log(error);
                }

            }
        }

    }
}
);