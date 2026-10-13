using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Encrypz.API.Controllers;

[ApiController, Authorize, Route("api/legacy-import")]
public class LegacyImportController(IHttpClientFactory clients) : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<IActionResult> Download(string id)
    {
        var token = await HttpContext.GetTokenAsync("access_token");
        var client = clients.CreateClient();
        var url = "https://www.googleapis.com/drive/v3/files/" + Uri.EscapeDataString(id);
        using var metadata = new HttpRequestMessage(HttpMethod.Get, url + "?fields=name");
        metadata.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var response = await client.SendAsync(metadata);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        if (!(json.RootElement.GetProperty("name").GetString()?.StartsWith("encrypz_file_", StringComparison.Ordinal) ?? false))
            return BadRequest("This is not an original Encrypz encrypted file.");
        using var request = new HttpRequestMessage(HttpMethod.Get, url + "?alt=media");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        using var download = await client.SendAsync(request);
        download.EnsureSuccessStatusCode();
        return File(await download.Content.ReadAsByteArrayAsync(), "application/octet-stream");
    }
}
