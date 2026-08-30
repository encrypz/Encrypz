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
    [ApiController]
    [Route("api/[controller]")]
    public class FilesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IGoogleDriveService _googleDriveService;

        public FilesController(ApplicationDbContext context, IGoogleDriveService googleDriveService)
        {
            _context = context;
            _googleDriveService = googleDriveService;
        }

        [HttpPost]
        public async Task<IActionResult> Upload([FromBody] FileUploadDto dto)
        {
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null) return NotFound("User not found.");
            if (string.IsNullOrEmpty(user.GoogleRefreshToken)) return BadRequest("Google Drive not connected.");

            var fileBytes = Convert.FromBase64String(dto.Payload);
            var driveFileId = await _googleDriveService.UploadFileAsync(user.GoogleRefreshToken, fileBytes, "encrypz_file_" + Guid.NewGuid().ToString());

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
            var query = _context.EncryptedFiles.Where(f => f.UserId == userId && !f.IsDeleted);

            if (folderId.HasValue)
            {
                query = query.Where(f => f.FolderId == folderId.Value);
            }
            else
            {
                query = query.Where(f => f.FolderId == null);
            }

            var files = await query
                .Select(f => new FileListDto
                {
                    Id = f.Id,
                    EncryptedFileName = Convert.ToBase64String(f.EncryptedFileName),
                FileSize = f.FileSize,
                UploadedAt = f.UploadedAt,
                    FolderId = f.FolderId,
                    EncryptedThumbnail = f.EncryptedThumbnail != null ? Convert.ToBase64String(f.EncryptedThumbnail) : null,
                    ThumbnailIv = f.ThumbnailIv != null ? Convert.ToBase64String(f.ThumbnailIv) : null,
                    ThumbnailAuthTag = f.ThumbnailAuthTag != null ? Convert.ToBase64String(f.ThumbnailAuthTag) : null
                })
                .ToListAsync();

            return Ok(files);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> DownloadFile(Guid id)
        {
            var file = await _context.EncryptedFiles.Include(f => f.User).FirstOrDefaultAsync(f => f.Id == id);
            if (file == null) return NotFound("File not found.");
            if (string.IsNullOrEmpty(file.User.GoogleRefreshToken)) return BadRequest("Google Drive not connected.");

            var fileBytes = await _googleDriveService.DownloadFileAsync(file.User.GoogleRefreshToken, file.GoogleDriveFileId);

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
            var files = await _context.EncryptedFiles
                .Where(f => f.UserId == userId && f.IsDeleted)
                .Select(f => new FileListDto
                {
                    Id = f.Id,
                    EncryptedFileName = Convert.ToBase64String(f.EncryptedFileName),
                FileSize = f.FileSize,
                UploadedAt = f.UploadedAt,
                    FolderId = f.FolderId,
                    EncryptedThumbnail = f.EncryptedThumbnail != null ? Convert.ToBase64String(f.EncryptedThumbnail) : null,
                    ThumbnailIv = f.ThumbnailIv != null ? Convert.ToBase64String(f.ThumbnailIv) : null,
                    ThumbnailAuthTag = f.ThumbnailAuthTag != null ? Convert.ToBase64String(f.ThumbnailAuthTag) : null
                })
                .ToListAsync();

            return Ok(files);
        }

        [HttpPost("{id}/restore")]
        public async Task<IActionResult> RestoreFile(Guid id)
        {
            var file = await _context.EncryptedFiles.FindAsync(id);
            if (file == null) return NotFound("File not found.");
            
            file.IsDeleted = false;
            file.DeletedAt = null;
            await _context.SaveChangesAsync();

            return Ok();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFile(Guid id) // Soft delete
        {
            var file = await _context.EncryptedFiles.FindAsync(id);
            if (file == null) return NotFound("File not found.");

            file.IsDeleted = true;
            file.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}/permanent")]
        public async Task<IActionResult> PermanentDeleteFile(Guid id)
        {
            var file = await _context.EncryptedFiles.Include(f => f.User).FirstOrDefaultAsync(f => f.Id == id);
            if (file == null) return NotFound("File not found.");

            if (!string.IsNullOrEmpty(file.GoogleDriveFileId) && !string.IsNullOrEmpty(file.User.GoogleRefreshToken))
            {
                try
                {
                    await _googleDriveService.DeleteFileAsync(file.User.GoogleRefreshToken, file.GoogleDriveFileId);
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
