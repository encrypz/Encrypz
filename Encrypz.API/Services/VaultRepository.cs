using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Encrypz.Core.DTOs;
using Encrypz.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication;

namespace Encrypz.API.Services;

public sealed class VaultConfig
{
    public int Version { get; set; }
    public int Iterations { get; set; }
    public string Salt { get; set; } = "";
    public string Iv { get; set; } = "";
    public string WrappedKey { get; set; } = "";
    public bool IsValid()
    {
        try { return Version == 2 && Iterations == 600000 && Convert.FromBase64String(Salt).Length == 32 &&
            Convert.FromBase64String(Iv).Length == 12 && Convert.FromBase64String(WrappedKey).Length == 48; }
        catch (FormatException) { return false; }
    }
}
public sealed class VaultFile : FileUploadDto
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string BlobId { get; set; } = "";
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
public sealed class VaultFolder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? ParentFolderId { get; set; }
    public string EncryptedFolderName { get; set; } = "";
    public string InitializationVector { get; set; } = "";
    public string AuthenticationTag { get; set; } = "";
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
public sealed record VaultRecord<T>(string DriveId, T Value);

public sealed class VaultRepository(IDriveVaultStore store, IHttpContextAccessor accessor)
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public static Guid UserId(ClaimsPrincipal user) => new(SHA256.HashData(Encoding.UTF8.GetBytes(
        user.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new UnauthorizedAccessException()))[..16]);
    private async Task<string> Token() => await accessor.HttpContext!.GetTokenAsync("access_token")
        ?? throw new HttpRequestException("Sign in again.", null, System.Net.HttpStatusCode.Unauthorized);
    public async Task<List<VaultRecord<T>>> List<T>(string kind) => (await store.ListAsync(await Token(), kind))
        .Select(d => new VaultRecord<T>(d.Id, JsonSerializer.Deserialize<T>(d.Content, Json)
            ?? throw new InvalidDataException("A vault record is damaged. Restore it from a backup."))).ToList();
    public async Task<string> Create<T>(string kind, T value) => await store.CreateAsync(await Token(), kind, JsonSerializer.SerializeToUtf8Bytes(value, Json));
    public async Task Update<T>(string kind, VaultRecord<T> record) => await store.UpdateAsync(await Token(), record.DriveId, kind, JsonSerializer.SerializeToUtf8Bytes(record.Value, Json));
    public async Task Delete(string kind, string id) => await store.DeleteAsync(await Token(), id, kind);
    public async Task<VaultConfig?> Config()
    {
        var configs = await List<VaultConfig>("config");
        if (configs.Count > 1) throw new InvalidDataException("Multiple vault configurations found. Stop using this vault and restore the correct configuration from backup.");
        var config = configs.SingleOrDefault()?.Value;
        if (config != null && !config.IsValid()) throw new InvalidDataException("Vault configuration is damaged or unsupported. Do not create a replacement vault.");
        return config;
    }
    public async Task<bool> HasRecords() => (await store.ListAsync(await Token(), "file")).Count > 0 ||
        (await store.ListAsync(await Token(), "folder")).Count > 0;
    public async Task<string> ReadBlob(string id)
    {
        var doc = await store.ReadAsync(await Token(), id, "blob")
            ?? throw new InvalidDataException("Encrypted file data is missing from Google Drive.");
        return JsonSerializer.Deserialize<string>(doc.Content, Json)!;
    }
}
