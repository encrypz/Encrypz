using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Auth.OAuth2.Responses;
using Google.Apis.Drive.v3;
using Google.Apis.Services;
using Google.Apis.Util.Store;
using Microsoft.Extensions.Configuration;
using System;
using System.IO;
using System.Threading.Tasks;

namespace Encrypz.Infrastructure.Services
{
    public interface IGoogleDriveService
    {
        string GetAuthorizationUrl(string redirectUri);
        Task<string> ExchangeCodeForRefreshTokenAsync(string code, string redirectUri);
        Task<string> UploadFileAsync(string refreshToken, byte[] fileBytes, string fileName);
        Task<byte[]> DownloadFileAsync(string refreshToken, string fileId);
    }

    public class GoogleDriveService : IGoogleDriveService
    {
        private readonly string _clientId;
        private readonly string _clientSecret;
        private readonly string[] _scopes = { DriveService.Scope.DriveFile };

        public GoogleDriveService(IConfiguration configuration)
        {
            _clientId = configuration["GoogleDrive:ClientId"] ?? "YOUR_CLIENT_ID";
            _clientSecret = configuration["GoogleDrive:ClientSecret"] ?? "YOUR_CLIENT_SECRET";
        }

        private GoogleAuthorizationCodeFlow GetFlow()
        {
            return new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
            {
                ClientSecrets = new ClientSecrets
                {
                    ClientId = _clientId,
                    ClientSecret = _clientSecret
                },
                Scopes = _scopes,
                DataStore = new NullDataStore()
            });
        }

        private DriveService GetDriveService(string refreshToken)
        {
            var credential = new UserCredential(GetFlow(), "user", new TokenResponse
            {
                RefreshToken = refreshToken
            });

            return new DriveService(new BaseClientService.Initializer
            {
                HttpClientInitializer = credential,
                ApplicationName = "Encrypz"
            });
        }

        public string GetAuthorizationUrl(string redirectUri)
        {
            var flow = GetFlow();
            var request = flow.CreateAuthorizationCodeRequest(redirectUri);
            // The request already includes access_type=offline by default in the .NET client
            // We just need to ensure prompt=consent is added so it always returns a refresh token
            var url = request.Build().ToString();
            if (!url.Contains("prompt=consent"))
            {
                url += "&prompt=consent";
            }
            return url;
        }

        public async Task<string> ExchangeCodeForRefreshTokenAsync(string code, string redirectUri)
        {
            var flow = GetFlow();
            var response = await flow.ExchangeCodeForTokenAsync("user", code, redirectUri, default);
            return response.RefreshToken;
        }

        public async Task<string> UploadFileAsync(string refreshToken, byte[] fileBytes, string fileName)
        {
            var service = GetDriveService(refreshToken);

            var fileMetadata = new Google.Apis.Drive.v3.Data.File()
            {
                Name = fileName,
                Parents = new[] { "root" } // Store in the root of the user's Drive
            };

            using var stream = new MemoryStream(fileBytes);
            var request = service.Files.Create(fileMetadata, stream, "application/octet-stream");
            request.Fields = "id";
            var response = await request.UploadAsync();

            if (response.Status != Google.Apis.Upload.UploadStatus.Completed)
            {
                throw new Exception($"Google Drive upload failed: {response.Exception?.Message}");
            }

            return request.ResponseBody.Id;
        }

        public async Task<byte[]> DownloadFileAsync(string refreshToken, string fileId)
        {
            var service = GetDriveService(refreshToken);

            using var stream = new MemoryStream();
            var request = service.Files.Get(fileId);
            await request.DownloadAsync(stream);

            return stream.ToArray();
        }
    }
}
