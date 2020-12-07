
const { app, Menu, shell } = require('electron')
const defaultMenu = require("electron-default-menu");

app.on('ready', () => {
    // Get default menu template
    const menu = defaultMenu(app, shell);

    // Add custom menu
    menu.splice(4, 0, {
        label: `Version ${process.env.npm_package_version}`,
    });

    // Set application menu
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
});