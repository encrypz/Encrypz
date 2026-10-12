using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Encrypz.Core.Entities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.Extensions.Options;
using System.Net;
using System.Text;
using Microsoft.AspNetCore.Authentication.Google;
using Encrypz.API;
using Encrypz.API.Services;
using Encrypz.Infrastructure.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace Encrypz.Tests;

public class SignInFlowTests
{
    [Fact]
    public async Task GoogleChallengeUsesProtectedStatePkceAndConfiguredCallback()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        var response = await client.GetAsync("/api/Auth/google-login");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var url = response.Headers.Location!;
        Assert.Equal("accounts.google.com", url.Host);
        var query = QueryHelpers.ParseQuery(url.Query);
        Assert.Equal("test-client", query["client_id"]);
        Assert.Equal("https://localhost/api/Auth/google-callback", query["redirect_uri"]);
        Assert.Equal("S256", query["code_challenge_method"]);
        Assert.False(string.IsNullOrEmpty(query["code_challenge"]));
        Assert.False(string.IsNullOrEmpty(query["state"]));
        Assert.Equal("offline", query["access_type"]);
        Assert.Contains("drive.file", query["scope"].ToString());
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), cookie => cookie.Contains(".AspNetCore.Correlation."));
    }

    [Theory]
    [InlineData("/api/Auth/session")]
    [InlineData("/api/Files/user/00000000-0000-0000-0000-000000000001")]
    [InlineData("/api/Folders/user/00000000-0000-0000-0000-000000000001")]
    public async Task ProtectedEndpointsRejectAnonymousRequests(string path)
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(path)).StatusCode);
    }

    [Fact]
    public async Task InvalidCallbackStateCannotCreateSession()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        var response = await client.GetAsync("/api/Auth/google-callback?code=invalid&state=forged");
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Contains("error=google_signin_failed", response.Headers.Location!.ToString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/Auth/session")).StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("https://attacker.example")]
    public async Task BrowserWritesRejectMissingOrForeignOrigin(string? origin)
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/Auth/logout");
        if (origin != null) request.Headers.Add("Origin", origin);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(request)).StatusCode);
    }

    [Fact]
    public async Task SuccessfulGoogleCallbackCreatesSessionAndLogoutClearsIt()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        var challenge = await client.GetAsync("/api/Auth/google-login");
        var state = QueryHelpers.ParseQuery(challenge.Headers.Location!.Query)["state"].ToString();
        var callback = await client.GetAsync(QueryHelpers.AddQueryString(
            "/api/Auth/google-callback?code=test-code", "state", state));
        Assert.Equal(HttpStatusCode.Redirect, callback.StatusCode);
        Assert.Equal("https://localhost/login?google=success", callback.Headers.Location!.ToString());
        var session = await client.GetAsync("/api/Auth/session");
        Assert.Equal(HttpStatusCode.OK, session.StatusCode);
        var body = await session.Content.ReadAsStringAsync();
        Assert.Contains("owner@example.com", body);
        Assert.Contains("\"isGoogleDriveConnected\":true", body);
        Assert.DoesNotContain("test-refresh", body);
        using var logout = new HttpRequestMessage(HttpMethod.Post, "/api/Auth/logout");
        logout.Headers.Add("Origin", "https://localhost");
        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(logout)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/Auth/session")).StatusCode);
    }

    [Fact]
    public async Task PasswordAccountHashesPasswordAndSupportsCaseInsensitiveLogin()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", "https://localhost");
        const string password = "my strong account password";
        var registered = await client.PostAsJsonAsync("/api/Auth/register", new { username = "VaultOwner", password });
        Assert.Equal(HttpStatusCode.OK, registered.StatusCode);
        var body = await registered.Content.ReadAsStringAsync();
        Assert.DoesNotContain(password, body);
        Assert.DoesNotContain("passwordHash", body);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var user = await db.Users.SingleAsync();
            Assert.NotEqual(password, user.PasswordHash);
            Assert.Equal(PasswordVerificationResult.Success,
                new PasswordHasher<User>().VerifyHashedPassword(user, user.PasswordHash!, password));
        }
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/Auth/register",
            new { username = "vaultowner", password })).StatusCode);
        await client.PostAsync("/api/Auth/logout", null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/Auth/login",
            new { username = "VaultOwner", password = "wrong account password" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/Auth/session")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/Auth/login",
            new { username = "vaultowner", password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/Auth/session")).StatusCode);
    }

    [Theory]
    [InlineData("ab", "long enough password")]
    [InlineData("invalid user", "long enough password")]
    [InlineData("validuser", "short")]
    public async Task RegistrationRejectsInvalidCredentials(string username, string password)
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", "https://localhost");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/Auth/register", new { username, password })).StatusCode);
    }

    [Fact]
    public async Task ConnectingGooglePreservesPasswordAccountsIdAndUsername()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", "https://localhost");
        var registered = await client.PostAsJsonAsync("/api/Auth/register", new { username = "MyVault", password = "long enough account password" });
        var before = JsonDocument.Parse(await registered.Content.ReadAsStringAsync()).RootElement;
        var challenge = await client.GetAsync("/api/Auth/google-connect");
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        var state = QueryHelpers.ParseQuery(challenge.Headers.Location!.Query)["state"].ToString();
        var callback = await client.GetAsync(QueryHelpers.AddQueryString("/api/Auth/google-callback?code=test-code", "state", state));
        Assert.Equal("https://localhost/login?google=success", callback.Headers.Location!.ToString());
        var after = JsonDocument.Parse(await client.GetStringAsync("/api/Auth/session")).RootElement;
        Assert.Equal(before.GetProperty("userId").GetString(), after.GetProperty("userId").GetString());
        Assert.Equal("MyVault", after.GetProperty("username").GetString());
        Assert.True(after.GetProperty("isGoogleDriveConnected").GetBoolean());
        using var scope = factory.Services.CreateScope();
        Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Users.CountAsync());
    }

    [Fact]
    public async Task GoogleLinkingRejectsCallbackAfterLocalLogout()
    {
        await using var factory = new TestApplication();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions
            { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Add("Origin", "https://localhost");
        await client.PostAsJsonAsync("/api/Auth/register", new { username = "MyVault", password = "long enough account password" });
        var challenge = await client.GetAsync("/api/Auth/google-connect");
        var state = QueryHelpers.ParseQuery(challenge.Headers.Location!.Query)["state"].ToString();
        await client.PostAsync("/api/Auth/logout", null);
        var callback = await client.GetAsync(QueryHelpers.AddQueryString("/api/Auth/google-callback?code=test-code", "state", state));
        Assert.Contains("error=google_signin_failed", callback.Headers.Location!.ToString());
        using var scope = factory.Services.CreateScope();
        Assert.Null((await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Users.SingleAsync()).GoogleSubject);
    }

    private sealed class GoogleBackchannel : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var json = request.RequestUri!.AbsolutePath.EndsWith("/token")
                ? """{"access_token":"test-access","refresh_token":"test-refresh","token_type":"Bearer","expires_in":3600,"scope":"openid email profile https://www.googleapis.com/auth/drive.file"}"""
                : """{"sub":"test-subject","email":"owner@example.com","name":"Owner"}""";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        }
    }

    private sealed class TestApplication : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["GoogleDrive:ClientId"] = "test-client",
                ["GoogleDrive:ClientSecret"] = "test-secret",
                ["Frontend:Url"] = "https://localhost",
                ["MongoDB:ConnectionString"] = "mongodb://localhost:27017",
                ["MongoDB:DatabaseName"] = "test"
            }));
            var databaseName = Guid.NewGuid().ToString();
            builder.ConfigureServices(services =>
            {
                services.PostConfigure<GoogleOptions>(GoogleDefaults.AuthenticationScheme, options =>
                    options.Backchannel = new HttpClient(new GoogleBackchannel()));
                services.RemoveAll<IConfigureOptions<KeyManagementOptions>>();
                services.AddDataProtection().UseEphemeralDataProtectionProvider();
                services.RemoveAll<ApplicationDbContext>();
                services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
                services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(databaseName));
                var cleanup = services.FirstOrDefault(service => service.ServiceType == typeof(IHostedService)
                    && service.ImplementationType == typeof(RecycleBinCleanupService));
                if (cleanup != null) services.Remove(cleanup);
            });
        }
    }
}
