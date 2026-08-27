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
                UserId = dto.UserId
            };

            _context.EncryptedFiles.Add(file);
            await _context.SaveChangesAsync();

            return Ok(new { file.Id });
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> ListFiles(Guid userId)
        {
            var files = await _context.EncryptedFiles
                .Where(f => f.UserId == userId)
                .Select(f => new FileListDto
                {
                    Id = f.Id,
                    EncryptedFileName = Convert.ToBase64String(f.EncryptedFileName)
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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFile(Guid id)
        {
            var file = await _context.EncryptedFiles.Include(f => f.User).FirstOrDefaultAsync(f => f.Id == id);
            if (file == null) return NotFound("File not found.");

            // If it's a new file with a Google Drive ID, delete it from Google Drive first
            if (!string.IsNullOrEmpty(file.GoogleDriveFileId) && !string.IsNullOrEmpty(file.User.GoogleRefreshToken))
            {
                try
                {
                    await _googleDriveService.DeleteFileAsync(file.User.GoogleRefreshToken, file.GoogleDriveFileId);
                }
                catch (Exception ex)
                {
                    // Log the error but proceed with DB deletion so it's not orphaned in the UI
                    Console.WriteLine($"Failed to delete file from Google Drive: {ex.Message}");
                }
            }

            // Remove from database
            _context.EncryptedFiles.Remove(file);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
