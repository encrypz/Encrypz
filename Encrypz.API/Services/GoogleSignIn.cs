using Microsoft.AspNetCore.Authentication;
using System.Security.Claims;
using Encrypz.Core.Entities;
using Encrypz.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.EntityFrameworkCore;

namespace Encrypz.API.Services;

public static class GoogleSignIn
{
    public static void AddGoogleSignIn(this WebApplicationBuilder builder)
    {
        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "encrypz.session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
                    ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.Events.OnRedirectToLogin = context =>
                {
                    context.Response.StatusCode = 401;
                    return Task.CompletedTask;
                };
                options.Events.OnRedirectToAccessDenied = context =>
                {
                    context.Response.StatusCode = 403;
                    return Task.CompletedTask;
                };
            })
            .AddGoogle(options =>
            {
                options.ClientId = builder.Configuration["GoogleDrive:ClientId"]
                    ?? throw new InvalidOperationException("Configure GoogleDrive__ClientId.");
                options.ClientSecret = builder.Configuration["GoogleDrive:ClientSecret"]
                    ?? throw new InvalidOperationException("Configure GoogleDrive__ClientSecret.");
                options.CallbackPath = "/api/Auth/google-callback";
                options.AccessType = "offline";
                options.UsePkce = true;
                options.Scope.Add("https://www.googleapis.com/auth/drive.file");
                // Tokens remain on the server, never in the browser's session cookie.
                options.SaveTokens = false;
                options.Events.OnCreatingTicket = async context =>
                {
                    var grantedScopes = context.TokenResponse.Response?.RootElement;
                    if (grantedScopes is null || !grantedScopes.Value.TryGetProperty("scope", out var scope) ||
                        !scope.GetString()!.Split(' ').Contains("https://www.googleapis.com/auth/drive.file"))
                        throw new InvalidOperationException("Google Drive permission is required for the vault.");
                    var subject = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? throw new InvalidOperationException("Google did not return an identity.");
                    var db = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
                    var googleUser = await db.Users.SingleOrDefaultAsync(u => u.GoogleSubject == subject);
                    User? user;
                    if (context.Properties.Items.TryGetValue("LinkUserId", out var linkId))
                    {
                        var session = await context.HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                        if (!session.Succeeded || session.Principal?.FindFirstValue(ClaimTypes.NameIdentifier) != linkId ||
                            !Guid.TryParse(linkId, out var userId))
                            throw new InvalidOperationException("Sign in again before connecting Google Drive.");
                        user = await db.Users.FindAsync(userId)
                            ?? throw new InvalidOperationException("Account no longer exists.");
                        if ((googleUser != null && googleUser.Id != user.Id) ||
                            (user.GoogleSubject != null && user.GoogleSubject != subject))
                            throw new InvalidOperationException("This Google account cannot be linked to this vault.");
                        user.GoogleSubject = subject;
                    }
                    else user = googleUser;
                    if (user == null)
                    {
                        user = new User
                        {
                            Id = Guid.NewGuid(), GoogleSubject = subject,
                            Username = context.Principal?.FindFirstValue(ClaimTypes.Email) ?? subject
                        };
                        db.Users.Add(user);
                    }
                    // Keep the existing token when Google does not issue a replacement.
                    if (!string.IsNullOrEmpty(context.RefreshToken))
                        user.GoogleRefreshToken = context.RefreshToken;
                    await db.SaveChangesAsync();
                    context.Principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                        new Claim(ClaimTypes.Name, user.Username)
                    }, CookieAuthenticationDefaults.AuthenticationScheme));
                };
                options.Events.OnRemoteFailure = context =>
                {
                    context.HandleResponse();
                    var frontend = builder.Configuration["Frontend:Url"] ?? "http://localhost:5173";
                    context.Response.Redirect(frontend.TrimEnd('/') + "/login?error=google_signin_failed");
                    return Task.CompletedTask;
                };
            });
        builder.Services.AddAuthorization();
    }
}
