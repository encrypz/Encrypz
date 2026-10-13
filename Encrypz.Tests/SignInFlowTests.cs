using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Encrypz.API;
using Encrypz.API.Services;
using Encrypz.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace Encrypz.Tests;

public class SignInFlowTests
{
    private static readonly VaultConfig Config = new() { Version = 2, Iterations = 600000,
        Salt = Convert.ToBase64String(new byte[32]), Iv = Convert.ToBase64String(new byte[12]), WrappedKey = Convert.ToBase64String(new byte[48]) };
    private static HttpClient Client(TestApplication app)
    {
        var client = app.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", "https://localhost");
        return client;
    }
    private static async Task<JsonElement> Login(HttpClient client)
    {
        var response = await client.GetAsync("/api/Auth/google-login");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var query = QueryHelpers.ParseQuery(response.Headers.Location!.Query);
        Assert.Equal("S256", query["code_challenge_method"]);
        Assert.Contains("drive.appdata", query["scope"].ToString());
        var callback = await client.GetAsync(QueryHelpers.AddQueryString("/api/Auth/google-callback?code=test", "state", query["state"].ToString()));
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        var session = await client.GetAsync("/api/Auth/session");
        var body = await session.Content.ReadAsStringAsync();
        Assert.True(session.IsSuccessStatusCode, body);
        return JsonDocument.Parse(body).RootElement;
    }
    [Theory]
    [InlineData("/api/Auth/session")]
    [InlineData("/api/Files/user/00000000-0000-0000-0000-000000000001")]
    [InlineData("/api/Folders/user/00000000-0000-0000-0000-000000000001")]
    public async Task AnonymousCannotReadVault(string url)
    {
        await using var app = new TestApplication(); using var client = Client(app);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(url)).StatusCode);
    }
    [Fact]
    public async Task DatabaseFreeGoogleSessionContainsNoTokensAndLogoutRevokesCookie()
    {
        await using var app = new TestApplication(); using var client = Client(app);
        var session = await Login(client);
        Assert.False(session.GetProperty("hasMasterPassword").GetBoolean());
        Assert.DoesNotContain("token-", session.GetRawText());
        var cookies = (await client.GetAsync("/api/Auth/session")).Headers.ToString();
        Assert.DoesNotContain("token-", cookies);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/Auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/Auth/session")).StatusCode);
    }
    [Fact]
    public async Task NewDeviceFindsSameEncryptedConfigAndFilesWithoutPasswordEndpoint()
    {
        await using var app = new TestApplication(); using var first = Client(app);
        var session = await Login(first); var id = session.GetProperty("userId").GetString();
        Assert.Equal(HttpStatusCode.NoContent, (await first.PostAsJsonAsync("/api/Auth/vault-config", Config)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await first.PostAsJsonAsync("/api/Auth/vault-config", Config)).StatusCode);
        var upload = await first.PostAsJsonAsync("/api/Files", Upload(id!));
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        using var second = Client(app);
        var restored = await Login(second);
        Assert.Equal(id, restored.GetProperty("userId").GetString());
        Assert.Equal(Config.WrappedKey, restored.GetProperty("vaultConfig").GetProperty("wrappedKey").GetString());
        var files = JsonDocument.Parse(await second.GetStringAsync($"/api/Files/user/{id}")).RootElement;
        Assert.Equal(1, files.GetArrayLength());
        var fileId = files[0].GetProperty("id").GetString();
        var download = JsonDocument.Parse(await second.GetStringAsync($"/api/Files/{fileId}/download")).RootElement;
        Assert.Equal("AQID", download.GetProperty("payload").GetString());
        var removed = await second.PostAsJsonAsync("/api/Auth/unlock", new { password = "never send this" });
        Assert.True(removed.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed);
    }
    [Fact]
    public async Task GoogleAccountsAreIsolatedAndSpoofedOwnersAreRejected()
    {
        await using var app = new TestApplication(); using var first = Client(app);
        var a = await Login(first); var id = a.GetProperty("userId").GetString()!;
        await first.PostAsJsonAsync("/api/Auth/vault-config", Config);
        var uploaded = JsonDocument.Parse(await (await first.PostAsJsonAsync("/api/Files", Upload(id))).Content.ReadAsStringAsync()).RootElement;
        app.Backchannel.Subject = "other";
        using var second = Client(app); var b = await Login(second);
        Assert.False(b.GetProperty("hasMasterPassword").GetBoolean());
        Assert.Equal(HttpStatusCode.Forbidden, (await second.GetAsync($"/api/Files/user/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await second.PostAsJsonAsync("/api/Files", Upload(id))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await second.GetAsync($"/api/Files/{uploaded.GetProperty("id").GetString()}/download")).StatusCode);
    }
    [Fact]
    public async Task RecycleBinRestoresAndDeletesFiles()
    {
        await using var app = new TestApplication(); using var client = Client(app);
        var session = await Login(client); var owner = session.GetProperty("userId").GetString()!;
        await client.PostAsJsonAsync("/api/Auth/vault-config", Config);
        var file = JsonDocument.Parse(await (await client.PostAsJsonAsync("/api/Files", Upload(owner))).Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString();
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/Files/{file}/permanent")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/Files/{file}")).StatusCode);
        Assert.Equal(1, JsonDocument.Parse(await client.GetStringAsync($"/api/Files/deleted/{owner}")).RootElement.GetArrayLength());
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync($"/api/Files/{file}/restore", null)).StatusCode);
        await client.DeleteAsync($"/api/Files/{file}");
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/Files/{file}/permanent")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/Files/{file}")).StatusCode);
    }
    [Fact]
    public async Task DamagedDuplicateOrMissingConfigNeverBecomesNewVault()
    {
        await using var app = new TestApplication(); using var client = Client(app);
        await Login(client);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/Auth/vault-config", new { version = 2 })).StatusCode);
        await app.Store.CreateAsync("token-owner", "file", "{}"u8.ToArray());
        Assert.Equal(HttpStatusCode.Conflict, (await client.GetAsync("/api/Auth/session")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/Auth/vault-config", Config)).StatusCode);
        await app.Store.CreateAsync("token-owner", "config", JsonSerializer.SerializeToUtf8Bytes(Config, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        await app.Store.CreateAsync("token-owner", "config", JsonSerializer.SerializeToUtf8Bytes(Config, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        Assert.Equal(HttpStatusCode.Conflict, (await client.GetAsync("/api/Auth/session")).StatusCode);
    }
    [Fact]
    public async Task RecoveryRestoresOnlyMissingConfigAndNeverOverwritesAnExistingKey()
    {
        await using var app = new TestApplication(); using var client = Client(app);
        await Login(client);
        await app.Store.CreateAsync("token-owner", "file", "{}"u8.ToArray());
        var missing = await client.GetAsync("/api/Auth/session");
        Assert.Equal(HttpStatusCode.Conflict, missing.StatusCode);
        Assert.True(JsonDocument.Parse(await missing.Content.ReadAsStringAsync()).RootElement.GetProperty("recoveryRequired").GetBoolean());
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/Auth/vault-config/recover", Config)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Auth/session")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/Auth/vault-config/recover", Config)).StatusCode);
    }
    [Fact]
    public async Task FolderHierarchyAndRecycleBinSurviveNewSessions()
    {
        await using var app = new TestApplication(); using var client = Client(app);
        var session = await Login(client); var owner = session.GetProperty("userId").GetString()!;
        await client.PostAsJsonAsync("/api/Auth/vault-config", Config);
        object Folder(string? parent) => new { userId = owner, parentFolderId = parent, encryptedFolderName = "AQID",
            initializationVector = Convert.ToBase64String(new byte[12]), authenticationTag = Convert.ToBase64String(new byte[16]) };
        var parent = JsonDocument.Parse(await (await client.PostAsJsonAsync("/api/Folders", Folder(null))).Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString()!;
        var child = JsonDocument.Parse(await (await client.PostAsJsonAsync("/api/Folders", Folder(parent))).Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetString()!;
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/Folders/{parent}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/Folders/{child}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/Folders/{parent}")).StatusCode);
        using var second = Client(app); await Login(second);
        Assert.Equal(2, JsonDocument.Parse(await second.GetStringAsync($"/api/Folders/deleted/{owner}")).RootElement.GetArrayLength());
        Assert.Equal(HttpStatusCode.Conflict, (await second.DeleteAsync($"/api/Folders/{parent}/permanent")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await second.PostAsync($"/api/Folders/{child}/restore", null)).StatusCode);
        // Restoring a child whose parent is trashed makes it visible at root.
        Assert.Equal(1, JsonDocument.Parse(await second.GetStringAsync($"/api/Folders/user/{owner}")).RootElement.GetArrayLength());
    }
    [Theory]
    [InlineData(null)]
    [InlineData("https://attacker.example")]
    public async Task ForeignOriginCannotWrite(string? origin)
    {
        await using var app = new TestApplication(); using var client = Client(app);
        client.DefaultRequestHeaders.Remove("Origin");
        if (origin != null) client.DefaultRequestHeaders.Add("Origin", origin);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync("/api/Auth/logout", null)).StatusCode);
    }
    [Fact]
    public async Task ForgedOAuthStateCannotSignIn()
    {
        await using var app = new TestApplication(); using var client = Client(app);
        var response = await client.GetAsync("/api/Auth/google-callback?code=x&state=forged");
        Assert.Contains("error=google_signin_failed", response.Headers.Location!.ToString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/Auth/session")).StatusCode);
    }
    private static object Upload(string owner) => new { userId = owner, encryptedFileName = "encrypted-name", payload = "AQID",
        initializationVector = Convert.ToBase64String(new byte[12]), authenticationTag = Convert.ToBase64String(new byte[16]) };

    internal sealed class FakeDrive : IDriveVaultStore
    {
        private readonly Dictionary<(string Token, string Id), (string Kind, byte[] Bytes)> data = new();
        public Task<IReadOnlyList<DriveDocument>> ListAsync(string token, string kind) => Task.FromResult<IReadOnlyList<DriveDocument>>(
            data.Where(e => e.Key.Token == token && e.Value.Kind == kind).Select(e => new DriveDocument(e.Key.Id, kind, e.Value.Bytes.ToArray())).ToList());
        public Task<DriveDocument?> ReadAsync(string token, string id, string kind) => Task.FromResult(
            data.TryGetValue((token, id), out var entry) && entry.Kind == kind ? new DriveDocument(id, kind, entry.Bytes.ToArray()) : null);
        public Task<string> CreateAsync(string token, string kind, byte[] content)
        { var id = Guid.NewGuid().ToString(); data.Add((token, id), (kind, content.ToArray())); return Task.FromResult(id); }
        public Task UpdateAsync(string token, string id, string kind, byte[] content)
        { if (!data.ContainsKey((token,id))) throw new Exception("Missing record"); data[(token,id)] = (kind,content.ToArray()); return Task.CompletedTask; }
        public Task DeleteAsync(string token, string id, string kind) { data.Remove((token,id)); return Task.CompletedTask; }
    }
    internal sealed class GoogleBackchannel : HttpMessageHandler
    {
        public string Subject = "owner";
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var json = request.RequestUri!.AbsolutePath.EndsWith("/token")
                ? $$"""{"access_token":"token-{{Subject}}","token_type":"Bearer","expires_in":3600,"scope":"openid email profile https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/drive.file"}"""
                : $$"""{"sub":"{{Subject}}","email":"{{Subject}}@example.com","name":"Owner"}""";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        }
    }
    // The development machine runs .NET 10 with the .NET 8 TestHost package.
    // Stream serialization avoids its incompatible PipeWriter implementation.
    private sealed class StreamJsonOutputFormatter : Microsoft.AspNetCore.Mvc.Formatters.TextOutputFormatter
    {
        public StreamJsonOutputFormatter() { SupportedMediaTypes.Add("application/json"); SupportedEncodings.Add(Encoding.UTF8); }
        public override bool CanWriteResult(Microsoft.AspNetCore.Mvc.Formatters.OutputFormatterCanWriteContext context) => true;
        public override Task WriteResponseBodyAsync(Microsoft.AspNetCore.Mvc.Formatters.OutputFormatterWriteContext context, Encoding encoding) =>
            JsonSerializer.SerializeAsync(context.HttpContext.Response.Body, context.Object, context.ObjectType ?? typeof(object), new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }
    internal sealed class TestApplication : WebApplicationFactory<Program>
    {
        public FakeDrive Store { get; } = new();
        public GoogleBackchannel Backchannel { get; } = new();
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(new Dictionary<string,string?> {
                ["GoogleDrive:ClientId"] = "test-client", ["GoogleDrive:ClientSecret"] = "test-secret", ["Frontend:Url"] = "https://localhost"
            }));
            builder.ConfigureServices(services => {
                services.PostConfigure<Microsoft.AspNetCore.Mvc.MvcOptions>(options =>
                {
                    options.OutputFormatters.RemoveType<Microsoft.AspNetCore.Mvc.Formatters.SystemTextJsonOutputFormatter>();
                    options.OutputFormatters.Insert(0, new StreamJsonOutputFormatter());
                });
                services.RemoveAll<IDriveVaultStore>(); services.AddSingleton<IDriveVaultStore>(Store);
                services.PostConfigure<GoogleOptions>(GoogleDefaults.AuthenticationScheme, o => o.Backchannel = new HttpClient(Backchannel));
            });
        }
    }
}
