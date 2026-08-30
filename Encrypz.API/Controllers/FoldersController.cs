using Encrypz.Core.Entities;
using Encrypz.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Encrypz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FoldersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public FoldersController(ApplicationDbContext context)
        {
            _context = context;
        }

        public class CreateFolderDto
        {
            public Guid UserId { get; set; }
            public Guid? ParentFolderId { get; set; }
            public string EncryptedFolderName { get; set; } // Base64
            public string InitializationVector { get; set; } // Base64
            public string AuthenticationTag { get; set; } // Base64
        }

        [HttpPost]
        public async Task<IActionResult> CreateFolder([FromBody] CreateFolderDto dto)
        {
            var folder = new Folder
            {
                Id = Guid.NewGuid(),
                UserId = dto.UserId,
                ParentFolderId = dto.ParentFolderId,
                EncryptedFolderName = Convert.FromBase64String(dto.EncryptedFolderName),
                InitializationVector = Convert.FromBase64String(dto.InitializationVector),
                AuthenticationTag = Convert.FromBase64String(dto.AuthenticationTag)
            };

            _context.Folders.Add(folder);
            await _context.SaveChangesAsync();

            return Ok(new { folder.Id });
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetFolders(Guid userId, [FromQuery] Guid? parentId)
        {
            var query = _context.Folders.Where(f => f.UserId == userId && !f.IsDeleted);
            
            if (parentId.HasValue)
            {
                query = query.Where(f => f.ParentFolderId == parentId.Value);
            }
            else
            {
                query = query.Where(f => f.ParentFolderId == null);
            }

            var folders = await query.ToListAsync();

            var result = folders.Select(f => new
            {
                f.Id,
                f.ParentFolderId,
                EncryptedFolderName = Convert.ToBase64String(f.EncryptedFolderName),
                InitializationVector = Convert.ToBase64String(f.InitializationVector),
                AuthenticationTag = Convert.ToBase64String(f.AuthenticationTag)
            });

            return Ok(result);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFolder(Guid id)
        {
            var folder = await _context.Folders.FindAsync(id);
            if (folder == null) return NotFound("Folder not found.");

            _context.Folders.Remove(folder);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
