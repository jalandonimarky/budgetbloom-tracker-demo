# BudgetBloom — Google Sheets Setup Guide

## Step 1: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet
2. Rename it to **"BudgetBloom Database"** (or any name you prefer)

## Step 2: Add the Apps Script

1. In the spreadsheet, go to **Extensions > Apps Script**
2. Delete any existing code in the editor
3. Copy the entire contents of `Code.gs` from this folder and paste it
4. Click the **Save** icon (or Ctrl+S)
5. Name the project **"BudgetBloom Backend"**

## Step 3: Run Initial Setup

1. In the Apps Script editor, select **`initialSetup`** from the function dropdown (top bar)
2. Click the **Run** button
3. You will be asked to authorize — click **Review Permissions**, select your Google account, click **Advanced > Go to BudgetBloom Backend**, then **Allow**
4. The script will create two tabs: **Transactions** and **Settings**
5. An alert will confirm setup is complete

## Step 4: Deploy as Web App

1. In the Apps Script editor, click **Deploy > New deployment**
2. Click the gear icon next to "Select type" and choose **Web app**
3. Set the following:
   - **Description:** BudgetBloom API
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**
5. **Copy the Web App URL** — you'll need this in the next step

## Step 5: Connect BudgetBloom

1. Open your BudgetBloom app (on Vercel or localhost)
2. Click **Settings** in the sidebar
3. Paste the Web App URL into the **API URL** field
4. Click **Connect** — you should see "Connected" status
5. Click **Push to Sheet** to upload your existing data to Google Sheets

## Done

Your BudgetBloom app is now connected to Google Sheets. All changes sync automatically.

### Updating the Script

If you update `Code.gs`, you must create a **new deployment version**:
1. Go to Apps Script editor
2. Click **Deploy > Manage deployments**
3. Click the pencil icon on your deployment
4. Change **Version** to "New version"
5. Click **Deploy**

The URL stays the same.
