# Google sign-in and Heroku

The Heroku image serves React and the API from one HTTPS origin. Google credentials are read only by the backend. `.env` and `.env.*` are excluded from Git and Docker builds; `.env.example` contains placeholders. Never put the client secret in a `VITE_` variable or a Docker build argument.

## Google Cloud setup

1. Enable the Google Drive API in the project that owns your OAuth client.
2. Configure the OAuth consent screen, support email, and audience. While in testing, add the Google accounts that will use the app as test users. The app requests identity scopes and `drive.file` for files it creates.
3. Use a **Web application** OAuth client. Add these authorized redirect URIs, exactly:
   - Local Vite development: `http://localhost:5173/api/Auth/google-callback`
   - Direct API / existing Docker Compose setup: `http://localhost:5207/api/Auth/google-callback`
   - Heroku: `https://YOUR-ACTUAL-HEROKU-HOST/api/Auth/google-callback`
4. Use the actual hostname shown by Heroku (including any generated suffix), or your custom domain. No JavaScript client secret is needed.

Google controls consent and any verification requirements. See [Google's web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).

## Run locally

The supplied credentials have been stored in the ignored root `.env` on this workstation. The MongoDB URI is stored there using `MongoDB__ConnectionString`, and `MongoDB__DatabaseName` selects the database (default `Encrypz`). Replace the `<db_username>` placeholder with your Atlas database username before starting. See `.env.example` for the other settings. Environment variables already set by the host take precedence over `.env`.

From the repository root, with .NET 8 and Node 24 installed:

```sh
dotnet run --project Encrypz.API -- --initialize-db
dotnet run --project Encrypz.API --launch-profile http
```

In another terminal:

```sh
cd Encrypz.UI
npm ci
npm run dev
```

Automatic recycle-bin cleanup is disabled in Development.

Open `http://localhost:5173`. Vite proxies `/api` to port 5207. The API's default frontend URL is `http://localhost:5173`; keep that URL consistent in the browser, configuration and Google Console.

## Deploy to Heroku

The app uses **MongoDB Atlas**. Set `MongoDB__ConnectionString` to the complete authenticated URI and `MongoDB__DatabaseName` to `Encrypz`. Keep TLS enabled, URL-encode reserved username/password characters, and permit the backend's network address through Atlas Network Access. The Atlas database user needs read/write access to the selected database.

`--initialize-db` creates the `Users`, `EncryptedFiles`, `Folders`, and `DataProtectionKeys` collections and their indexes. The Google subject and normalized local username each have a unique partial index. Re-run initialization after upgrading to username/password support. Run initialization before serving traffic; Heroku's release command does this automatically. Atlas provides the replica set needed for transactional `SaveChanges`.

MongoDB does not use SQL migrations. The old MySQL/PostgreSQL migration sources remain under `Migrations` for reference and are excluded from compilation. Existing SQL data is not copied or deleted. Transferring an existing vault requires preserving IDs, usernames, encrypted bytes, Drive file IDs and refresh tokens. Changing databases without transferring those records creates a new empty vault. See [MongoDB's EF provider documentation](https://www.mongodb.com/docs/entity-framework/current/).

Create an app and select the container stack:

```sh
heroku create YOUR-APP-NAME --stack container
```

In the Heroku dashboard, open **Settings → Config Vars** and set:

| Key | Value |
| --- | --- |
| `GoogleDrive__ClientId` | Your Google OAuth client ID |
| `GoogleDrive__ClientSecret` | Your Google OAuth client secret |
| `MongoDB__ConnectionString` | Your authenticated MongoDB Atlas URI |
| `MongoDB__DatabaseName` | `Encrypz` |
| `Frontend__Url` | `https://YOUR-ACTUAL-HEROKU-HOST` |
| `Frontend__AllowedOrigins` | The same HTTPS origin, without a trailing slash |
| `ASPNETCORE_ENVIRONMENT` | `Production` |

Do not copy production credentials into committed files. Heroku injects its own `PORT`, which the API reads at startup.

After reviewing and committing the source changes, deploy using Heroku Git or its GitHub integration:

```sh
heroku git:remote -a YOUR-APP-NAME
git push heroku HEAD:main
```

`heroku.yml` builds `Heroku.Dockerfile`, initializes MongoDB collections and indexes in the release phase, then starts the web process. The frontend uses `/api`, so no frontend build-time secret or production API URL is necessary. See [Heroku's heroku.yml guide](https://devcenter.heroku.com/articles/build-docker-images-heroku-yml).

## Automated checks

```sh
dotnet test Encrypz.Tests/Encrypz.Tests.csproj
npm --prefix Encrypz.UI run build
npm --prefix Encrypz.UI run lint
```

The tests use a mocked Google backchannel and an in-memory database; they do not prove that the live OAuth client or production MongoDB connection is configured correctly. The existing npm dependency tree reported four audit findings during installation (two moderate, one high, one critical); review and resolve these before production. Frontend lint also reports existing warnings.

## Account registration

Users can create a username/password account at `/register`, or use Google sign-in. Local usernames use 3–32 ASCII letters, numbers, or underscores and are unique without regard to case. Account passwords use 12–128 characters and are stored using ASP.NET Core Identity's salted password hasher. Login and registration are rate-limited.

The account password authenticates with the server. The separate master password encrypts vault data and stays in the browser; users should choose different passwords. Password accounts connect Google Drive through `/api/Auth/google-connect`, which binds the link to the currently authenticated account and preserves the vault username and ID. A Google identity already attached to another account cannot be linked.

## Verify after deployment

- Open `/health`, then sign in with a Google test account and grant Drive access.
- Choose a master password for a new vault. For an existing Google vault, use its original password. The app does not validate that password at login; incorrect passwords will fail when decrypting existing data.
- Upload and download a small file, sign out, then sign in again and decrypt it.
- Confirm `/api/Auth/session` returns 401 after signing out.
- API requests without a session cannot access files, folders, or profiles. Requests for another user's IDs are rejected. Browser writes also require an allowed `Origin` header.

Session protection keys are stored in the MongoDB `DataProtectionKeys` collection so dyno restarts and multiple dynos can share sessions. This database also contains Google refresh tokens; restrict database access, protect backups, and use encryption at rest through your database provider.

Legacy username-only accounts are preserved but cannot sign in through the removed unauthenticated username endpoints. They are **not automatically linked** to Google by email/username. Existing vaults need an administrator-assisted ownership migration: set the verified Google subject on the original user and preserve its ID and username (the username is part of the existing encryption-key derivation). Do not merge accounts based only on a matching email.

The supplied secret was shared in chat. Rotate it in Google Cloud before production, then replace the local `.env` and Heroku Config Var values. No live Google consent flow, database initialization, or Heroku deployment can be completed solely from source configuration; these require the actual Google Console settings and deployment database.
