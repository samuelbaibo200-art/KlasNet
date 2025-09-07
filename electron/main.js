const { app, BrowserWindow } = require('electron');
const path = require('path');


function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.resolve('C:/Users/elmas/Downloads/ChatGPT_Image_26_août_2025__23_29_50-removebg-preview.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const isDev = process.env.NODE_ENV !== 'production';
  win.loadURL(
    isDev
      ? 'http://localhost:5173'
      : `file://${path.resolve(__dirname, '..', 'dist', 'index.html')}`
  );

  // Suppression de l'ouverture automatique de la console Electron
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
