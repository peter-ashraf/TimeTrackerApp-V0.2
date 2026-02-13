# TimeTracker Data Recovery Guide

## 🔐 Password Recovery & Data Extraction

If you've forgotten your username or password, don't worry! Your timesheet data is still safe and can be recovered. Since all data is encrypted and stored locally in your browser for security, we've created several recovery options.

## 🚀 Quick Recovery Options

### Option 1: Use the Built-in Recovery Link (Easiest)

1. Open the TimeTracker app
2. On the login screen, click **"Forgot Password?"**
3. Follow the step-by-step instructions in the popup
4. This will guide you through recovering your data using browser developer tools

### Option 2: Use the Recovery Tool (Recommended)

1. Open the `data-recovery-tool.html` file in your browser
2. Click **"Start Automatic Recovery"** to find and recover all your data
3. The tool will automatically download backup files for each user account found
4. Create a new account in TimeTracker and import your data

### Option 3: Manual Recovery with JavaScript

1. Open the TimeTracker app
2. Press **F12** to open browser developer tools
3. Go to the **Console** tab
4. Copy and paste this script:
   ```javascript
   fetch('./data-extraction-utility.js').then(r=>r.text()).then(eval)
   ```
5. Then run: `performDataRecovery()`
6. Your backup files will download automatically

## 📋 Step-by-Step Recovery Process

### Step 1: Extract Your Data
- Use any of the methods above to recover your encrypted timesheet data
- The recovery process will create JSON backup files containing all your data
- Files are named like: `timetracker_backup_username_2026-02-13.json`

### Step 2: Create a New Account
- Open the TimeTracker app
- Click **"Sign Up"** to create a new account
- Use any username and password you'll remember

### Step 3: Import Your Data
- After logging into your new account, go to **Settings**
- Look for the **Import** option
- Select the backup file you downloaded
- All your timesheet entries, pay periods, and settings will be restored

## 🔧 Advanced Recovery Options

### If You Remember Your Username
If you remember your username but not your password:

1. Open the recovery tool (`data-recovery-tool.html`)
2. Enter your username in the **Manual Recovery** section
3. Click **"Try Specific Username"**
4. This will recover data for that specific user only

### Analyze What Data Exists
To see what data is available in your browser:

1. Open the recovery tool
2. Click **"Analyze LocalStorage"**
3. This will show you all potential usernames and data items found

### Last Resort: Clear All Data
If you want to start completely fresh:

1. Open the recovery tool
2. Click **"Clear All Data (Last Resort)"**
3. This will remove all TimeTracker data from your browser
4. You can then start with a completely new account

## 📁 What's Included in Your Backup

Your backup file contains:

- **Time Entries**: All your tracked work hours
- **Pay Periods**: Your pay period configurations
- **User Settings**: Full name, salary, vacation days, sick days
- **Current Period**: Your currently selected pay period
- **Metadata**: Export date and username for reference

## ⚠️ Important Security Notes

- **Data is Encrypted**: Your data is encrypted with your username as the key
- **No Password Reset**: For security, passwords cannot be reset - only data can be recovered
- **Local Storage**: All data is stored only in your browser, not on any server
- **Backup Files**: Keep your backup files safe as they contain all your timesheet data

## 🆘 Troubleshooting

### No Data Found
- **Different Browser**: Open the recovery tool in the browser where you used TimeTracker
- **Cleared Data**: If you cleared browser data, your timesheet data may be lost
- **Private Browsing**: Data in private/incognito mode is not saved

### Recovery Fails
- **Try Different Method**: Use the HTML recovery tool instead of console commands
- **Check Username**: Try variations of your username if you're not sure
- **Multiple Attempts**: The automatic recovery tries all possible usernames

### Import Issues
- **File Format**: Make sure you're importing the JSON backup file
- **New Account**: Ensure you're logged into a new account before importing
- **File Size**: Large backup files may take a moment to import

## 📞 Getting Help

If you're still having trouble:

1. **Try All Methods**: Use both the automatic and manual recovery options
2. **Check Backups**: Look for any existing backup files you may have
3. **Browser Data**: Ensure you're using the same browser and device where you used TimeTracker

## 💡 Prevention Tips

To avoid this situation in the future:

- **Save Backup Files**: Regularly export your data using the app's backup feature
- **Remember Credentials**: Store your username and password securely
- **Multiple Browsers**: Consider using the same browser consistently
- **Regular Exports**: Export your data periodically as a safety measure

---

**Your timesheet data is valuable and recoverable!** Follow these steps carefully and you'll have your data restored in no time.
