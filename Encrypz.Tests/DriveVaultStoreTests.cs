using System.Net;
using System.Text;
using Encrypz.Infrastructure.Services;
using Xunit;

namespace Encrypz.Tests;
public class DriveVaultStoreTests
{
    [Fact]
    public async Task ListsAllPagesAndUsesOnlyPrivateAppData()
    {
        var calls = new List<string>();
        var handler = new Handler(request => {
            Assert.Equal("Bearer secret", request.Headers.Authorization!.ToString());
            var url = request.RequestUri!.ToString(); calls.Add(url);
            if (url.Contains("alt=media")) return Json("{}");
            Assert.Contains("spaces=appDataFolder", url);
            return url.Contains("pageToken=next") ? Json("""{"files":[{"id":"second","name":"encrypz-v2-file.json"}]}""")
                : Json("""{"nextPageToken":"next","files":[{"id":"first","name":"encrypz-v2-file.json"}]}""");
        });
        var store = new DriveVaultStore(new HttpClient(handler));
        var docs = await store.ListAsync("secret", "file");
        Assert.Equal(new[] { "first", "second" }, docs.Select(d => d.Id));
        Assert.Equal(4, calls.Count);
    }
    [Theory]
    [InlineData("unrelated.json", "appDataFolder")]
    [InlineData("encrypz-v2-file.json", "drive")]
    public async Task CannotReadOrMutateUnrelatedDriveFiles(string name, string space)
    {
        var handler = new Handler(request => {
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.DoesNotContain("alt=media", request.RequestUri!.Query);
            return Json($$"""{"id":"foreign","name":"{{name}}","spaces":["{{space}}"],"trashed":false}""");
        });
        var store = new DriveVaultStore(new HttpClient(handler));
        Assert.Null(await store.ReadAsync("secret", "foreign", "file"));
        await store.DeleteAsync("secret", "foreign", "file");
        var error = await Assert.ThrowsAsync<HttpRequestException>(() => store.UpdateAsync("secret", "foreign", "file", "{}"u8.ToArray()));
        Assert.Equal(HttpStatusCode.NotFound, error.StatusCode);
    }
    [Fact]
    public async Task DriveFailureIsNotMistakenForAnEmptyVault()
    {
        var store = new DriveVaultStore(new HttpClient(new Handler(_ => new HttpResponseMessage(HttpStatusCode.Forbidden))));
        await Assert.ThrowsAsync<HttpRequestException>(() => store.ListAsync("secret", "config"));
    }
    [Fact]
    public async Task CreatesAnAppDataDocumentWithMultipartContent()
    {
        var handler = new AsyncHandler(async request => {
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Contains("uploadType=multipart", request.RequestUri!.Query);
            var body = await request.Content!.ReadAsStringAsync();
            Assert.Contains("appDataFolder", body);
            Assert.Contains("encrypz-v2-config.json", body);
            Assert.Contains("wrappedKey", body);
            return Json("""{"id":"created"}""");
        });
        var store = new DriveVaultStore(new HttpClient(handler));
        Assert.Equal("created", await store.CreateAsync("secret", "config", "{\"wrappedKey\":\"encrypted\"}"u8.ToArray()));
    }
    private static HttpResponseMessage Json(string text) => new(HttpStatusCode.OK) { Content = new StringContent(text, Encoding.UTF8, "application/json") };
    private sealed class Handler(Func<HttpRequestMessage,HttpResponseMessage> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(send(request));
    }
    private sealed class AsyncHandler(Func<HttpRequestMessage,Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => send(request);
    }
}
