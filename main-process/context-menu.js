const contextMenu = require('electron-context-menu');


contextMenu({
    prepend: (params, browserWindow) => [
        {
            role: "reload",
            label:"Actualiser"
            // If you want to change the label "Zoom In"
            // label: "Custom Zoom In Text"
        },
    ],
    labels: {
        undo: 'Retour',
        cut: 'Couper',
        copy: 'Copier',
        paste: 'Coller',
        save: 'Enregistrer',
        saveImageAs: 'Enregistrer sous...',
        copyLink: 'Copier le lien',
        copyImage: 'Copier l\'image',
        copyImageAddress: 'Copier l\'adresse de l\'image',
        inspect: 'Inspecter l\'élément'
    }
});
