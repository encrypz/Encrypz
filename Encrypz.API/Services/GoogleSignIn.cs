using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;

namespace Encrypz.API.Services;

public static class GoogleSignIn
{
    public static void AddGoogleSignIn(this WebApplicationBuilder builder)
    {
        builder.Services.AddMemoryCache();
        builder.Services.AddSingleton<MemoryTicketStore>();
        builder.Services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
            .Configure<MemoryTicketStore>((options, store) => options.SessionStore = store);
        builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = "encrypz.drive-session";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Lax;
                options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
                options.ExpireTimeSpan = TimeSpan.FromMinutes(50);
                options.SlidingExpiration = false;
                options.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
                options.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
            })
            .AddGoogle(options =>
            {
                options.ClientId = builder.Configuration["GoogleDrive:ClientId"] ?? "not-configured";
                options.ClientSecret = builder.Configuration["GoogleDrive:ClientSecret"] ?? "not-configured";
                options.CallbackPath = "/api/Auth/google-callback";
                options.AccessType = "online";
                options.UsePkce = true;
                options.Scope.Add("https://www.googleapis.com/auth/drive.appdata");
                // Retain drive.file only to import existing encrypted files from older vaults.
                options.Scope.Add("https://www.googleapis.com/auth/drive.file");
                options.SaveTokens = true;
                options.CorrelationCookie.SameSite = SameSiteMode.Lax;
                options.CorrelationCookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
                options.Events.OnCreatingTicket = context =>
                {
                    var response = context.TokenResponse.Response?.RootElement;
                    if (response == null || !response.Value.TryGetProperty("scope", out var scope) ||
                        !scope.GetString()!.Split(' ').Contains("https://www.googleapis.com/auth/drive.appdata"))
                        throw new InvalidOperationException("Google Drive app data permission is required.");
                    var subject = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                        ?? throw new InvalidOperationException("Google identity missing.");
                    var email = context.Principal?.FindFirstValue(ClaimTypes.Email) ?? subject;
                    context.Principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, subject), new Claim(ClaimTypes.Name, email)
                    }, CookieAuthenticationDefaults.AuthenticationScheme));
                    context.Properties.ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(50);
                    context.Properties.IsPersistent = false;
                    return Task.CompletedTask;
                };
                options.Events.OnRemoteFailure = context =>
                {
                    context.HandleResponse();
                    context.Response.Redirect((builder.Configuration["Frontend:Url"] ?? "http://localhost:5173").TrimEnd('/') + "/login?error=google_signin_failed");
                    return Task.CompletedTask;
                };
            });
        builder.Services.AddAuthorization();
    }
}
