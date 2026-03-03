# How to Install and Run the App

To run `npm run dev`, you need to have **Node.js** and **NPM** (Node Package Manager) installed on your system. It appears they are currently missing.

Follow these steps to get everything set up:

## 1. Install Node.js
1. Go to the official [Node.js website](https://nodejs.org/).
2. Download the **LTS (Long Term Support)** version for Windows.
3. Run the installer and follow the default prompts. This will also install NPM.

## 2. Verify Installation
Once installed, open a **new** terminal (PowerShell or Command Prompt) and run:
```powershell
node -v
npm -v
```
You should see version numbers (e.g., `v20.x.x` and `10.x.x`).

## 3. Install Dependencies
In your project directory (`d:\Career Development\TimeTrackerApp-V0.2`), run the following command to install the required libraries:
```powershell
npm install
```

## 4. Run the Development Server
Finally, start the app with:
```powershell
npm run dev
```
Wait for the terminal to show a URL (usually `http://localhost:5173`). Open that link in your browser to see the app running.

---
> [!TIP]
> If you have already installed Node.js but it's still not working, you may need to restart your terminal or IDE (VS Code) for the changes to take effect.
