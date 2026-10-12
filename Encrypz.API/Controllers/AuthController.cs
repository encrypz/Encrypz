using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using Encrypz.Core.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using Encrypz.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Encrypz.API.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        private static readonly PasswordHasher<User> PasswordHasher = new();
        private static readonly string DummyHash = PasswordHasher.HashPassword(new User(), Guid.NewGuid().ToString());

        public sealed class CredentialsRequest
        {
            [Required, StringLength(32, MinimumLength = 3)]
            public string Username { get; set; } = string.Empty;
            [Required, StringLength(128, MinimumLength = 12)]
            public string Password { get; set; } = string.Empty;
        }

        [AllowAnonymous]
        [EnableRateLimiting("credentials")]
        [HttpPost("register")]
        public async Task<IActionResult> Register(CredentialsRequest request)
        {
            var username = request.Username.Trim();
            if (!Regex.IsMatch(username, @"\A[a-zA-Z0-9_]{3,32}\z"))
                return BadRequest("Use 3–32 letters, numbers, or underscores for your username.");
            var normalized = username.ToUpperInvariant();
            if (await _context.Users.AnyAsync(u => u.NormalizedUsername == normalized))
                return Conflict("That username is unavailable.");
            var user = new User { Id = Guid.NewGuid(), Username = username, NormalizedUsername = normalized };
            user.PasswordHash = PasswordHasher.HashPassword(user, request.Password);
            _context.Users.Add(user);
            try { await _context.SaveChangesAsync(); }
            catch (Exception exception) when (exception.ToString().Contains("E11000", StringComparison.Ordinal))
            {
                return Conflict("That username is unavailable.");
            }
            await StartSession(user);
            return AccountSession(user);
        }

        [AllowAnonymous]
        [EnableRateLimiting("credentials")]
        [HttpPost("login")]
        public async Task<IActionResult> Login(CredentialsRequest request)
        {
            var normalized = request.Username.Trim().ToUpperInvariant();
            var user = await _context.Users.SingleOrDefaultAsync(u => u.NormalizedUsername == normalized);
            var result = PasswordHasher.VerifyHashedPassword(user ?? new User(), user?.PasswordHash ?? DummyHash, request.Password);
            if (user?.PasswordHash == null || result == PasswordVerificationResult.Failed)
                return Unauthorized("Invalid username or password.");
            if (result == PasswordVerificationResult.SuccessRehashNeeded)
            {
                user.PasswordHash = PasswordHasher.HashPassword(user, request.Password);
                await _context.SaveChangesAsync();
            }
            await StartSession(user);
            return AccountSession(user);
        }

        private Task StartSession(User user) => HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username)
            }, CookieAuthenticationDefaults.AuthenticationScheme)));

        private IActionResult AccountSession(User user)
        {
            Response.Headers.CacheControl = "no-store";
            return Ok(new { UserId = user.Id, user.Username,
                IsGoogleDriveConnected = !string.IsNullOrEmpty(user.GoogleRefreshToken) });
        }

        [HttpGet("google-connect")]
        public IActionResult GoogleConnect()
        {
            var frontend = _configuration["Frontend:Url"] ?? "http://localhost:5173";
            var properties = new GoogleChallengeProperties
            {
                RedirectUri = frontend.TrimEnd('/') + "/login?google=success", Prompt = "consent"
            };
            // Protected OAuth state binds linking to this authenticated account.
            properties.Items["LinkUserId"] = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Challenge(properties, GoogleDefaults.AuthenticationScheme);
        }

        [AllowAnonymous]
        [HttpGet("google-login")]
        public IActionResult GoogleLogin()
        {
            var frontend = _configuration["Frontend:Url"] ?? "http://localhost:5173";
            return Challenge(new GoogleChallengeProperties
            {
                RedirectUri = frontend.TrimEnd('/') + "/login?google=success",
                Prompt = "consent"
            }, GoogleDefaults.AuthenticationScheme);
        }

        [HttpGet("session")]
        public async Task<IActionResult> Session()
        {
            var id = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _context.Users.FindAsync(id);
            if (user == null) return Unauthorized();
            Response.Headers.CacheControl = "no-store";
            return Ok(new { UserId = user.Id, user.Username,
                IsGoogleDriveConnected = !string.IsNullOrEmpty(user.GoogleRefreshToken) });
        }

        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return NoContent();
        }

        [HttpGet("user/{userId}")]
        public async Task<IActionResult> GetUserProfile(Guid userId)
        {
            if (User.FindFirstValue(ClaimTypes.NameIdentifier) != userId.ToString()) return Forbid();
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == userId);
                
            if (user == null) return NotFound("User not found.");

            var folderCount = await _context.Folders.CountAsync(f => f.UserId == userId);

            return Ok(new
            {
                Username = user.Username,
                IsGoogleDriveConnected = !string.IsNullOrEmpty(user.GoogleRefreshToken),
                FileCount = await _context.EncryptedFiles.CountAsync(f => f.UserId == userId),
                FolderCount = folderCount
            });
        }
    }
}
