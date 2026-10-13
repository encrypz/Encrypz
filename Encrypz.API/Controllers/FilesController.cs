using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using Encrypz.Core.DTOs;
using Encrypz.Core.Entities;
using Encrypz.Infrastructure.Data;
using Encrypz.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Encrypz.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FilesController : ControllerBase
    {
        private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private readonly ApplicationDbContext _context;
        private readonly IGoogleDriveService _googleDriveService;

        public FilesController(ApplicationDbContext context, IGoogleDriveService googleDriveService)
        {
            _context = context;
            _googleDriveService = googleDriveService;
        }

        [HttpPost]
        [DisableRequestSizeLimit]
        public async Task<IActionResult> Upload([FromBody] FileUploadDto dto)
        {
            if (dto.UserId != CurrentUserId) return Forbid();
            if (dto.FolderId.HasValue && !await _context.Folders.AnyAsync(
                f => f.Id == dto.FolderId && f.UserId == CurrentUserId && !f.IsDeleted))
                return BadRequest("Invalid parent folder.");
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound("User not found.");

            ConnectedGoogleAccount? account = null;
            if (dto.GoogleAccountId.HasValue)
            {
                account = await _context.GoogleAccounts.FirstOrDefaultAsync(g => g.Id == dto.GoogleAccountId.Value && g.UserId == CurrentUserId);
            }
            if (account == null)
            {
                account = await _context.GoogleAccounts.FirstOrDefaultAsync(g => g.UserId == CurrentUserId);
            }

            var refreshToken = account?.RefreshToken ?? user.GoogleRefreshToken;
            if (string.IsNullOrEmpty(refreshToken)) return BadRequest("Google Drive not connected.");

            var fileBytes = Convert.FromBase64String(dto.Payload);
            var driveFileId = await _googleDriveService.UploadFileAsync(refreshToken, fileBytes, "encrypz_file_" + Guid.NewGuid().ToString());

            var file = new EncryptedFile
            {
                Id = Guid.NewGuid(),
                EncryptedFileName = Convert.FromBase64String(dto.EncryptedFileName),
                GoogleDriveFileId = driveFileId,
                InitializationVector = Convert.FromBase64String(dto.InitializationVector),
                AuthenticationTag = Convert.FromBase64String(dto.AuthenticationTag),
                FileSize = dto.FileSize,
                UploadedAt = DateTime.UtcNow,
                UserId = dto.UserId,
                FolderId = dto.FolderId,
                GoogleAccountId = account?.Id,
                GoogleAccountEmail = account?.Email,
                EncryptedThumbnail = string.IsNullOrEmpty(dto.EncryptedThumbnail) ? null : Convert.FromBase64String(dto.EncryptedThumbnail),
                ThumbnailIv = string.IsNullOrEmpty(dto.ThumbnailIv) ? null : Convert.FromBase64String(dto.ThumbnailIv),
                ThumbnailAuthTag = string.IsNullOrEmpty(dto.ThumbnailAuthTag) ? null : Convert.FromBase64String(dto.ThumbnailAuthTag)
            };

            _context.EncryptedFiles.Add(file);
            await _context.SaveChangesAsync();

            return Ok(new { file.Id });
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> ListFiles(Guid userId, [FromQuery] Guid? folderId)
        {
            if (userId != CurrentUserId) return Forbid();
            var query = _context.EncryptedFiles.Where(f => f.UserId == userId && !f.IsDeleted);

            if (folderId.HasValue)
            {
                query = query.Where(f => f.FolderId == folderId.Value);
            }
            else
            {
                query = query.Where(f => f.FolderId == null);
            }

            var records = await query.ToListAsync();
            var files = records
                .Select(f => new FileListDto
                {
                    Id = f.Id,
                    EncryptedFileName = Convert.ToBase64String(f.EncryptedFileName),
                    FileSize = f.FileSize,
                    UploadedAt = f.UploadedAt,
                    FolderId = f.FolderId,
                    GoogleAccountId = f.GoogleAccountId,
                    GoogleAccountEmail = f.GoogleAccountEmail,
                    EncryptedThumbnail = f.EncryptedThumbnail != null ? Convert.ToBase64String(f.EncryptedThumbnail) : null,
                    ThumbnailIv = f.ThumbnailIv != null ? Convert.ToBase64String(f.ThumbnailIv) : null,
                    ThumbnailAuthTag = f.ThumbnailAuthTag != null ? Convert.ToBase64String(f.ThumbnailAuthTag) : null
                })
                .ToList();

            return Ok(files);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> DownloadFile(Guid id)
        {
            var file = await _context.EncryptedFiles.FirstOrDefaultAsync(f => f.Id == id);
            if (file == null || file.UserId != CurrentUserId) return NotFound("File not found.");

            string? refreshToken = null;
            if (file.GoogleAccountId.HasValue)
            {
                var account = await _context.GoogleAccounts.FirstOrDefaultAsync(g => g.Id == file.GoogleAccountId.Value && g.UserId == CurrentUserId);
                refreshToken = account?.RefreshToken;
            }
            if (string.IsNullOrEmpty(refreshToken))
            {
                var user = await _context.Users.FindAsync(file.UserId);
                refreshToken = user?.GoogleRefreshToken;
            }
            if (string.IsNullOrEmpty(refreshToken))
            {
                var anyAccount = await _context.GoogleAccounts.FirstOrDefaultAsync(g => g.UserId == CurrentUserId);
                refreshToken = anyAccount?.RefreshToken;
            }

            if (string.IsNullOrEmpty(refreshToken)) return BadRequest("Google Drive not connected.");

            var fileBytes = await _googleDriveService.DownloadFileAsync(refreshToken, file.GoogleDriveFileId);

            var dto = new FileDownloadDto
            {
                Id = file.Id,
                EncryptedFileName = Convert.ToBase64String(file.EncryptedFileName),
                Payload = Convert.ToBase64String(fileBytes),
                InitializationVector = Convert.ToBase64String(file.InitializationVector),
                AuthenticationTag = Convert.ToBase64String(file.AuthenticationTag)
            };

            return Ok(dto);
        }

        [HttpGet("deleted/{userId}")]
        public async Task<IActionResult> GetDeletedFiles(Guid userId)
        {
            if (userId != CurrentUserId) return Forbid();
            var records = await _context.EncryptedFiles
                .Where(f => f.UserId == userId && f.IsDeleted).ToListAsync();
            var files = records
                .Select(f => new FileListDto
                {
                    Id = f.Id,
                    EncryptedFileName = Convert.ToBase64String(f.EncryptedFileName),
                    FileSize = f.FileSize,
                    UploadedAt = f.UploadedAt,
                    FolderId = f.FolderId,
                    GoogleAccountId = f.GoogleAccountId,
                    GoogleAccountEmail = f.GoogleAccountEmail,
                    EncryptedThumbnail = f.EncryptedThumbnail != null ? Convert.ToBase64String(f.EncryptedThumbnail) : null,
                    ThumbnailIv = f.ThumbnailIv != null ? Convert.ToBase64String(f.ThumbnailIv) : null,
                    ThumbnailAuthTag = f.ThumbnailAuthTag != null ? Convert.ToBase64String(f.ThumbnailAuthTag) : null
                })
                .ToList();

            return Ok(files);
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreFile(Guid id)
        {
            var file = await _context.EncryptedFiles.FindAsync(id);
            if (file == null || file.UserId != CurrentUserId) return NotFound("File not found.");
            
            file.IsDeleted = false;
            file.DeletedAt = null;
            await _context.SaveChangesAsync();

            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFile(Guid id) // Soft delete
        {
            var file = await _context.EncryptedFiles.FindAsync(id);
            if (file == null || file.UserId != CurrentUserId) return NotFound("File not found.");

            file.IsDeleted = true;
            file.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}/permanent")]
        public async Task<IActionResult> PermanentDeleteFile(Guid id)
        {
            var file = await _context.EncryptedFiles.FirstOrDefaultAsync(f => f.Id == id);
            if (file == null || file.UserId != CurrentUserId) return NotFound("File not found.");

            string? refreshToken = null;
            if (file.GoogleAccountId.HasValue)
            {
                var account = await _context.GoogleAccounts.FirstOrDefaultAsync(g => g.Id == file.GoogleAccountId.Value && g.UserId == CurrentUserId);
                refreshToken = account?.RefreshToken;
            }
            if (string.IsNullOrEmpty(refreshToken))
            {
                var user = await _context.Users.FindAsync(file.UserId);
                refreshToken = user?.GoogleRefreshToken;
            }
            if (string.IsNullOrEmpty(refreshToken))
            {
                var anyAccount = await _context.GoogleAccounts.FirstOrDefaultAsync(g => g.UserId == CurrentUserId);
                refreshToken = anyAccount?.RefreshToken;
            }

            if (!string.IsNullOrEmpty(file.GoogleDriveFileId) && !string.IsNullOrEmpty(refreshToken))
            {
                try
                {
                    await _googleDriveService.DeleteFileAsync(refreshToken, file.GoogleDriveFileId);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Failed to delete file from Google Drive: {ex.Message}");
                }
            }

            _context.EncryptedFiles.Remove(file);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
