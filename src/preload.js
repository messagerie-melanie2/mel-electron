
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
        let validChannels = ["read_mail_dir", "mail_select", "eml_read", "attachment_select", "subfolder", "subfolder_settings", "download_eml", "get_archive_folder", "get_archive_path", "search_list", "read_unread", "flag_unflagged", "stop-archivage", "delete_selected_mail", "import-archivage", "new_archive_path", "create_folder", "delete_folder", "change_archive_path", "log_export", "account_electron"];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receive: (channel, func) => {
        if (channel != undefined) {

            let validChannels = ["mail_dir", "mail_return", "eml_return", "listSubfolder", "listSubfolder_settings", "download-finish", "download-advancement", "archive_folder", "archive_path", "new_folder", "add_message_row", "result_search", "import-advancement", "import-finish", "new_archive_path_result","change_archive_path_success"];
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