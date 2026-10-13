using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Encrypz.Infrastructure.Services;

public sealed record DriveDocument(string Id, string Name, byte[] Content);

public interface IDriveVaultStore
{
    Task<IReadOnlyList<DriveDocument>> ListAsync(string token, string kind);
    Task<DriveDocument?> ReadAsync(string token, string id, string kind);
    Task<string> CreateAsync(string token, string kind, byte[] content);
    Task UpdateAsync(string token, string id, string kind, byte[] content);
    Task DeleteAsync(string token, string id, string kind);
}

// Each item is an independent document: uploads on different devices never overwrite
// a shared manifest. Only app-private records are addressable through this store.
public sealed class DriveVaultStore(HttpClient http) : IDriveVaultStore
{
    private const string Api = "https://www.googleapis.com/drive/v3/files";
    private const string Upload = "https://www.googleapis.com/upload/drive/v3/files";
    private static string Name(string kind) => $"encrypz-v2-{kind}.json";
    private static HttpRequestMessage Request(HttpMethod method, string url, string token)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }
    private async Task<HttpResponseMessage> Send(HttpRequestMessage request)
    {
        var response = await http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var status = response.StatusCode;
            response.Dispose();
            throw new HttpRequestException("Google Drive request failed.", null, status);
        }
        return response;
    }
    public async Task<IReadOnlyList<DriveDocument>> ListAsync(string token, string kind)
    {
        var result = new List<DriveDocument>();
        string? page = null;
        do
        {
            var query = Uri.EscapeDataString($"name = '{Name(kind)}' and trashed = false");
            using var request = Request(HttpMethod.Get, $"{Api}?spaces=appDataFolder&q={query}&fields=nextPageToken,files(id,name)&pageSize=1000&pageToken={Uri.EscapeDataString(page ?? "")}", token);
            using var response = await Send(request);
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            foreach (var item in json.RootElement.GetProperty("files").EnumerateArray())
            {
                var id = item.GetProperty("id").GetString()!;
                using var download = Request(HttpMethod.Get, $"{Api}/{Uri.EscapeDataString(id)}?alt=media", token);
                try
                {
                    using var data = await Send(download);
                    result.Add(new(id, Name(kind), await data.Content.ReadAsByteArrayAsync()));
                }
                catch (HttpRequestException e) when (e.StatusCode == HttpStatusCode.NotFound) { /* Concurrent deletion. */ }
            }
            page = json.RootElement.TryGetProperty("nextPageToken", out var next) ? next.GetString() : null;
        } while (page != null);
        return result;
    }
    public async Task<DriveDocument?> ReadAsync(string token, string id, string kind)
    {
        var escaped = Uri.EscapeDataString(id);
        try
        {
            using var request = Request(HttpMethod.Get, $"{Api}/{escaped}?fields=id,name,spaces,trashed", token);
            using var response = await Send(request);
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
            var item = json.RootElement;
            if (item.GetProperty("name").GetString() != Name(kind) || item.GetProperty("trashed").GetBoolean() ||
                !item.GetProperty("spaces").EnumerateArray().Any(s => s.GetString() == "appDataFolder")) return null;
            using var download = Request(HttpMethod.Get, $"{Api}/{escaped}?alt=media", token);
            using var data = await Send(download);
            return new(id, Name(kind), await data.Content.ReadAsByteArrayAsync());
        }
        catch (HttpRequestException e) when (e.StatusCode == HttpStatusCode.NotFound) { return null; }
    }
    public async Task<string> CreateAsync(string token, string kind, byte[] content)
    {
        using var request = Request(HttpMethod.Post, $"{Upload}?uploadType=multipart&fields=id", token);
        var multipart = new MultipartContent("related");
        multipart.Add(JsonContent.Create(new { name = Name(kind), parents = new[] { "appDataFolder" } }));
        var data = new ByteArrayContent(content);
        data.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        multipart.Add(data);
        request.Content = multipart;
        using var response = await Send(request);
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return json.RootElement.GetProperty("id").GetString()!;
    }
    public async Task UpdateAsync(string token, string id, string kind, byte[] content)
    {
        if (await ReadAsync(token, id, kind) == null) throw new HttpRequestException("Record not found.", null, HttpStatusCode.NotFound);
        using var request = Request(HttpMethod.Patch, $"{Upload}/{Uri.EscapeDataString(id)}?uploadType=media", token);
        request.Content = new ByteArrayContent(content);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        using var response = await Send(request);
    }
    public async Task DeleteAsync(string token, string id, string kind)
    {
        if (await ReadAsync(token, id, kind) == null) return;
        using var request = Request(HttpMethod.Delete, $"{Api}/{Uri.EscapeDataString(id)}", token);
        using var response = await Send(request);
    }
}
