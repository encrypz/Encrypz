using Encrypz.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Encrypz.API.Controllers;

[ApiController, Authorize, Route("api/[controller]")]
public class FoldersController(VaultRepository vault) : ControllerBase
{
    private Guid Owner => VaultRepository.UserId(User);
    [HttpPost]
    public async Task<IActionResult> Create(VaultFolder dto)
    {
        if (dto.UserId != Owner) return Forbid();
        if (await vault.Config() == null) return Conflict("Create your vault first.");
        var folders = await vault.List<VaultFolder>("folder");
        if (dto.ParentFolderId.HasValue && !folders.Any(f => f.Value.Id == dto.ParentFolderId && !f.Value.IsDeleted)) return BadRequest("Invalid parent folder.");
        try
        {
            if (Convert.FromBase64String(dto.InitializationVector).Length != 12 || Convert.FromBase64String(dto.AuthenticationTag).Length != 16)
                return BadRequest("Invalid encryption parameters.");
            Convert.FromBase64String(dto.EncryptedFolderName);
        }
        catch (FormatException) { return BadRequest("Invalid encrypted folder name."); }
        dto.Id = Guid.NewGuid(); dto.IsDeleted = false; dto.DeletedAt = null;
        await vault.Create("folder", dto);
        return Ok(new { dto.Id });
    }
    [HttpGet("user/{userId:guid}")]
    public async Task<IActionResult> List(Guid userId, Guid? parentId)
    {
        if (userId != Owner) return Forbid();
        var folders = (await vault.List<VaultFolder>("folder")).Select(f => f.Value).Where(f => !f.IsDeleted).ToList();
        return Ok(folders.Where(f => parentId.HasValue ? f.ParentFolderId == parentId :
            !f.ParentFolderId.HasValue || !folders.Any(p => p.Id == f.ParentFolderId)));
    }
    [HttpGet("deleted/{userId:guid}")]
    public async Task<IActionResult> Deleted(Guid userId) => userId != Owner ? Forbid() :
        Ok((await vault.List<VaultFolder>("folder")).Select(f => f.Value).Where(f => f.IsDeleted));
    [HttpDelete("{id:guid}")]
    public Task<IActionResult> Trash(Guid id) => SetDeleted(id, true);
    [HttpPost("{id:guid}/restore")]
    public Task<IActionResult> Restore(Guid id) => SetDeleted(id, false);
    private async Task<IActionResult> SetDeleted(Guid id, bool deleted)
    {
        var folders = await vault.List<VaultFolder>("folder");
        var record = folders.SingleOrDefault(f => f.Value.Id == id);
        if (record == null) return NotFound();
        if (deleted && folders.Any(f => f.Value.ParentFolderId == id && !f.Value.IsDeleted)) return Conflict("Remove subfolders first.");
        record.Value.IsDeleted = deleted; record.Value.DeletedAt = deleted ? DateTime.UtcNow : null;
        await vault.Update("folder", record);
        return NoContent();
    }
    [HttpDelete("{id:guid}/permanent")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var folders = await vault.List<VaultFolder>("folder");
        var record = folders.SingleOrDefault(f => f.Value.Id == id);
        if (record == null) return NotFound();
        if (!record.Value.IsDeleted || folders.Any(f => f.Value.ParentFolderId == id)) return Conflict("Remove this folder and its subfolders first.");
        await vault.Delete("folder", record.DriveId);
        return NoContent();
    }
}
