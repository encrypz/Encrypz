using Encrypz.Core.Entities;
using Encrypz.Infrastructure.Data;
using Encrypz.Infrastructure.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace Encrypz.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IGoogleDriveService _googleDriveService;

        public AuthController(ApplicationDbContext context, IGoogleDriveService googleDriveService)
        {
            _context = context;
            _googleDriveService = googleDriveService;
        }

        public class LoginRequest
        {
            public string Username { get; set; } = string.Empty;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username))
            {
                return BadRequest("Username is required.");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);

            if (user == null)
            {
                return Unauthorized("User not found. Please register first.");
            }

            return Ok(new { UserId = user.Id, Username = user.Username });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] LoginRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Username))
            {
                return BadRequest("Username is required.");
            }

            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (existingUser != null)
            {
                return BadRequest("Username already exists.");
            }

            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = request.Username
            };
            
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return Ok(new { UserId = user.Id, Username = user.Username, IsGoogleDriveConnected = !string.IsNullOrEmpty(user.GoogleRefreshToken) });
        }

        [HttpGet("google-login")]
        public IActionResult GoogleLogin()
        {
            var redirectUri = "http://localhost:5207/api/Auth/google-callback";
            var url = _googleDriveService.GetAuthorizationUrl(redirectUri);
            return Ok(new { Url = url });
        }

        [HttpGet("google-callback")]
        public async Task<IActionResult> GoogleCallback([FromQuery] string code, [FromQuery] string state)
        {
            // For simplicity in MVP, we might pass the userId in the state parameter
            if (string.IsNullOrEmpty(code) || !Guid.TryParse(state, out var userId))
            {
                return BadRequest("Invalid callback parameters.");
            }

            var redirectUri = "http://localhost:5207/api/Auth/google-callback";
            var refreshToken = await _googleDriveService.ExchangeCodeForRefreshTokenAsync(code, redirectUri);

            var user = await _context.Users.FindAsync(userId);
            if (user != null)
            {
                user.GoogleRefreshToken = refreshToken;
                await _context.SaveChangesAsync();
            }

            // Redirect back to frontend with success flag
            return Redirect("http://localhost:5173/vault?connected=true");
        }
    }
}
