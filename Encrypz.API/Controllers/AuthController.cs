using System.Security.Claims;
using Encrypz.API.Services;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Encrypz.API.Controllers;

[ApiController, Authorize, Route("api/[controller]")]
public class AuthController(VaultRepository vault, IConfiguration configuration) : ControllerBase
{
    [AllowAnonymous, HttpGet("google-login")]
    public IActionResult GoogleLogin() => Challenge(new GoogleChallengeProperties
    {
        RedirectUri = (configuration["Frontend:Url"] ?? "http://localhost:5173").TrimEnd('/') + "/login?google=success",
        Prompt = "select_account consent"
    }, GoogleDefaults.AuthenticationScheme);

    [HttpGet("session")]
    public async Task<IActionResult> Session()
    {
        Response.Headers.CacheControl = "no-store";
        var config = await vault.Config();
        if (config == null && await vault.HasRecords())
            return Conflict(new { message = "Vault configuration is missing. Restore your configuration backup to unlock existing files.",
                userId = VaultRepository.UserId(User), username = User.FindFirstValue(ClaimTypes.Name), recoveryRequired = true });
        return Ok(new { userId = VaultRepository.UserId(User), username = User.FindFirstValue(ClaimTypes.Name),
            isGoogleDriveConnected = true, hasMasterPassword = config != null, vaultConfig = config });
    }
    [HttpPost("vault-config")]
    public async Task<IActionResult> CreateConfig(VaultConfig config)
    {
        if (!config.IsValid()) return BadRequest("Invalid encrypted vault configuration.");
        if (await vault.Config() != null || await vault.HasRecords()) return Conflict("A vault already exists. Sign in again to unlock it.");
        await vault.Create("config", config);
        // Drive has no unique-name constraint: concurrent initialization fails closed.
        await vault.Config();
        return NoContent();
    }
    [HttpPost("vault-config/recover")]
    public async Task<IActionResult> RecoverConfig(VaultConfig config)
    {
        if (!config.IsValid()) return BadRequest("Invalid encrypted vault configuration.");
        if (await vault.Config() != null) return Conflict("A configuration already exists and cannot be replaced.");
        // The browser verifies the backup with the password before submitting it.
        await vault.Create("config", config);
        await vault.Config();
        return NoContent();
    }
    [HttpGet("google-accounts")]
    public IActionResult Accounts() => Ok(new[] { new { id = VaultRepository.UserId(User),
        email = User.FindFirstValue(ClaimTypes.Name), displayName = User.FindFirstValue(ClaimTypes.Name) } });
    [HttpGet("user/{userId:guid}")]
    public async Task<IActionResult> Profile(Guid userId)
    {
        if (userId != VaultRepository.UserId(User)) return Forbid();
        return Ok(new { username = User.FindFirstValue(ClaimTypes.Name), isGoogleDriveConnected = true,
            fileCount = (await vault.List<VaultFile>("file")).Count(f => !f.Value.IsDeleted),
            folderCount = (await vault.List<VaultFolder>("folder")).Count(f => !f.Value.IsDeleted) });
    }
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }
}
