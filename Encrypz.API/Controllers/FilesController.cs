using Encrypz.API.Services;
using Encrypz.Core.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Encrypz.API.Controllers;

[ApiController, Authorize, Route("api/[controller]")]
public class FilesController(VaultRepository vault) : ControllerBase
{
    private Guid Owner => VaultRepository.UserId(User);
    private async Task<VaultRecord<VaultFile>?> Find(Guid id) => (await vault.List<VaultFile>("file")).SingleOrDefault(f => f.Value.Id == id);
    [HttpPost, RequestSizeLimit(100_000_000)]
    public async Task<IActionResult> Upload(FileUploadDto dto)
    {
        if (dto.UserId != Owner || (dto.GoogleAccountId.HasValue && dto.GoogleAccountId != Owner)) return Forbid();
        if (await vault.Config() == null) return Conflict("Create your vault first.");
        if (dto.FolderId.HasValue && !(await vault.List<VaultFolder>("folder")).Any(f => f.Value.Id == dto.FolderId && !f.Value.IsDeleted))
            return BadRequest("Invalid parent folder.");
        try
        {
            if (Convert.FromBase64String(dto.InitializationVector).Length != 12 || Convert.FromBase64String(dto.AuthenticationTag).Length != 16)
                return BadRequest("Invalid encryption parameters.");
            Convert.FromBase64String(dto.Payload);
        }
        catch (FormatException) { return BadRequest("Invalid encrypted data."); }
        var file = new VaultFile { UserId = Owner, FolderId = dto.FolderId, EncryptedFileName = dto.EncryptedFileName,
            FileSize = dto.FileSize, UploadedAt = DateTime.UtcNow, InitializationVector = dto.InitializationVector,
            AuthenticationTag = dto.AuthenticationTag, EncryptedThumbnail = dto.EncryptedThumbnail,
            ThumbnailIv = dto.ThumbnailIv, ThumbnailAuthTag = dto.ThumbnailAuthTag };
        file.BlobId = await vault.Create("blob", dto.Payload);
        // If metadata creation fails, retain the encrypted blob for recovery rather than risking data loss.
        await vault.Create("file", file);
        return Ok(new { file.Id });
    }
    [HttpGet("user/{userId:guid}")]
    public async Task<IActionResult> ListFiles(Guid userId, Guid? folderId)
    {
        if (userId != Owner) return Forbid();
        var folders = (await vault.List<VaultFolder>("folder")).Where(f => !f.Value.IsDeleted).Select(f => f.Value.Id).ToHashSet();
        var files = (await vault.List<VaultFile>("file")).Select(f => f.Value).Where(f => !f.IsDeleted);
        // Orphaned files are visible at root even if a folder was removed on another device.
        return Ok(files.Where(f => folderId.HasValue ? f.FolderId == folderId : !f.FolderId.HasValue || !folders.Contains(f.FolderId.Value)));
    }
    [HttpGet("deleted/{userId:guid}")]
    public async Task<IActionResult> Deleted(Guid userId) => userId != Owner ? Forbid() :
        Ok((await vault.List<VaultFile>("file")).Select(f => f.Value).Where(f => f.IsDeleted));
    [HttpGet("{id:guid}"), HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id)
    {
        var record = await Find(id);
        if (record == null) return NotFound();
        var file = record.Value;
        return Ok(new FileDownloadDto { Id = file.Id, EncryptedFileName = file.EncryptedFileName,
            Payload = await vault.ReadBlob(file.BlobId), InitializationVector = file.InitializationVector, AuthenticationTag = file.AuthenticationTag });
    }
    [HttpDelete("{id:guid}")]
    public Task<IActionResult> Trash(Guid id) => SetDeleted(id, true);
    [HttpPost("{id:guid}/restore")]
    public Task<IActionResult> Restore(Guid id) => SetDeleted(id, false);
    private async Task<IActionResult> SetDeleted(Guid id, bool deleted)
    {
        var record = await Find(id);
        if (record == null) return NotFound();
        record.Value.IsDeleted = deleted;
        record.Value.DeletedAt = deleted ? DateTime.UtcNow : null;
        await vault.Update("file", record);
        return NoContent();
    }
    [HttpDelete("{id:guid}/permanent")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var record = await Find(id);
        if (record == null) return NotFound();
        if (!record.Value.IsDeleted) return Conflict("Move the file to the recycle bin first.");
        await vault.Delete("blob", record.Value.BlobId);
        await vault.Delete("file", record.DriveId);
        return NoContent();
    }
}
