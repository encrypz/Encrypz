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
                options.CorrelationCookie.SameSite = SameSiteMode.Lax;
                options.CorrelationCookie.SecurePolicy = builder.Environment.IsDevelopment()
                    ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
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
                    var email = context.Principal?.FindFirstValue(ClaimTypes.Email);
                    var name = context.Principal?.FindFirstValue(ClaimTypes.Name);
                    var db = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

                    User? user = null;
                    if (context.Properties.Items.TryGetValue("LinkUserId", out var linkId))
                    {
                        var session = await context.HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                        if (!session.Succeeded || session.Principal?.FindFirstValue(ClaimTypes.NameIdentifier) != linkId ||
                            !Guid.TryParse(linkId, out var userId))
                            throw new InvalidOperationException("Sign in again before connecting Google Drive.");
                        user = await db.Users.FindAsync(userId)
                            ?? throw new InvalidOperationException("Account no longer exists.");

                        // Ensure this Google account is not connected to a different Encrypz user
                        var linkedToOther = await db.GoogleAccounts.FirstOrDefaultAsync(g => g.GoogleSubject == subject && g.UserId != user.Id);
                        var legacyOther = await db.Users.FirstOrDefaultAsync(u => u.GoogleSubject == subject && u.Id != user.Id);
                        if (linkedToOther != null || legacyOther != null)
                            throw new InvalidOperationException("This Google account is already linked to another Encrypz account.");

                        // Link or update the connected Google account for this user
                        var existingAcct = await db.GoogleAccounts.FirstOrDefaultAsync(g => g.GoogleSubject == subject && g.UserId == user.Id);
                        if (existingAcct != null)
                        {
                            if (!string.IsNullOrEmpty(context.RefreshToken)) existingAcct.RefreshToken = context.RefreshToken;
                            if (!string.IsNullOrEmpty(email)) existingAcct.Email = email;
                            if (!string.IsNullOrEmpty(name)) existingAcct.DisplayName = name;
                        }
                        else
                        {
                            var newAcct = new ConnectedGoogleAccount
                            {
                                Id = Guid.NewGuid(),
                                UserId = user.Id,
                                GoogleSubject = subject,
                                Email = email,
                                DisplayName = name,
                                RefreshToken = context.RefreshToken ?? user.GoogleRefreshToken ?? string.Empty,
                                ConnectedAt = DateTime.UtcNow
                            };
                            db.GoogleAccounts.Add(newAcct);
                        }

                        // Maintain primary user reference for backwards compatibility
                        if (string.IsNullOrEmpty(user.GoogleRefreshToken) && !string.IsNullOrEmpty(context.RefreshToken))
                        {
                            user.GoogleRefreshToken = context.RefreshToken;
                            user.GoogleSubject = subject;
                        }
                        else if (user.GoogleSubject == subject && !string.IsNullOrEmpty(context.RefreshToken))
                        {
                            user.GoogleRefreshToken = context.RefreshToken;
                        }
                    }
                    else
                    {
                        // Google Login: look up user across all connected accounts
                        var linkedAccount = await db.GoogleAccounts.FirstOrDefaultAsync(g => g.GoogleSubject == subject);
                        if (linkedAccount != null)
                        {
                            user = await db.Users.FindAsync(linkedAccount.UserId);
                            if (!string.IsNullOrEmpty(context.RefreshToken)) linkedAccount.RefreshToken = context.RefreshToken;
                            if (!string.IsNullOrEmpty(email)) linkedAccount.Email = email;
                            if (!string.IsNullOrEmpty(name)) linkedAccount.DisplayName = name;
                        }
                        else
                        {
                            var legacyUser = await db.Users.FirstOrDefaultAsync(u => u.GoogleSubject == subject);
                            if (legacyUser != null)
                            {
                                user = legacyUser;
                                var acct = new ConnectedGoogleAccount
                                {
                                    Id = Guid.NewGuid(),
                                    UserId = user.Id,
                                    GoogleSubject = subject,
                                    Email = email,
                                    DisplayName = name,
                                    RefreshToken = context.RefreshToken ?? user.GoogleRefreshToken ?? string.Empty,
                                    ConnectedAt = DateTime.UtcNow
                                };
                                db.GoogleAccounts.Add(acct);
                            }
                        }

                        if (user == null)
                        {
                            // New user registering with Google
                            user = new User
                            {
                                Id = Guid.NewGuid(),
                                GoogleSubject = subject,
                                Username = email ?? subject,
                                GoogleRefreshToken = context.RefreshToken
                            };
                            db.Users.Add(user);
                            var acct = new ConnectedGoogleAccount
                            {
                                Id = Guid.NewGuid(),
                                UserId = user.Id,
                                GoogleSubject = subject,
                                Email = email,
                                DisplayName = name,
                                RefreshToken = context.RefreshToken ?? string.Empty,
                                ConnectedAt = DateTime.UtcNow
                            };
                            db.GoogleAccounts.Add(acct);
                        }
                        else if (!string.IsNullOrEmpty(context.RefreshToken) && user.GoogleSubject == subject)
                        {
                            user.GoogleRefreshToken = context.RefreshToken;
                        }
                    }

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
