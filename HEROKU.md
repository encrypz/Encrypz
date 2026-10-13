# Deploy Encrypz without a database

The `Heroku.Dockerfile` builds the React UI and .NET API into one application. No database add-on, migrations, initialization command, or MongoDB configuration is required.

## Google setup

Enable Google Drive API in your Google Cloud project. Create an OAuth web application client and configure the consent screen/test users as appropriate. Add this authorized redirect URI, substituting your application hostname:

```
https://YOUR-APP.herokuapp.com/api/Auth/google-callback
```

The requested scopes include Google identity, `https://www.googleapis.com/auth/drive.appdata`, and `https://www.googleapis.com/auth/drive.file`. App data holds the vault; `drive.file` allows importing files created by the older version. Existing users must grant the new app-data permission.

## Application configuration

Set these private deployment variables:

```
GoogleDrive__ClientId=YOUR-OAUTH-CLIENT-ID
GoogleDrive__ClientSecret=YOUR-OAUTH-CLIENT-SECRET
Frontend__Url=https://YOUR-APP.herokuapp.com
Frontend__AllowedOrigins=https://YOUR-APP.herokuapp.com
ASPNETCORE_ENVIRONMENT=Production
```

Heroku supplies `PORT`. Use the repository's `heroku.yml` container deployment, or build/push `Heroku.Dockerfile` using your existing pipeline. Run one web instance. Session tickets and OAuth tokens live in memory and expire after at most 50 minutes; dyno restarts sign users out. Vault data and encrypted key configuration persist on their Google Drive. Multiple instances require a separate session-sharing design.

`GET /health` checks that the server is running, not Google credentials or Drive availability. Validate Google consent, first-time setup, upload/download, sign-out, and unlock from a second browser with your actual OAuth project before production use.

## Updating an older deployment

Export and back up the old database before removing it. Follow the [legacy import instructions](README.md#importing-an-existing-mongodb-vault). Do not delete the old database or Drive files until the imported files have been verified. Existing environment secrets can remain during migration, but the new runtime ignores MongoDB settings.

Google application data is hidden from the normal Drive file list. Users can delete it from Drive's app-management settings, which can destroy the vault. Configuration backups and limitations are documented in the README.
