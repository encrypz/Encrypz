using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Encrypz.Infrastructure.Services;
using Encrypz.API.Services;
using Microsoft.AspNetCore.HttpOverrides;

namespace Encrypz.API;

public class Program
{
    public static void Main(string[] args)
    {
        DotNetEnv.Env.NoClobber().TraversePath().Load();
        var builder = WebApplication.CreateBuilder(args);

        var port = Environment.GetEnvironmentVariable("PORT");
        if (!string.IsNullOrEmpty(port)) builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
        builder.AddGoogleSignIn();
        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedProto;
            // Heroku's router is the only public ingress to a dyno.
            if (!string.IsNullOrEmpty(port))
            {
                options.KnownNetworks.Clear();
                options.KnownProxies.Clear();
            }
        });

        // Temporary sessions intentionally expire on application restart.
        builder.Services.AddDataProtection().UseEphemeralDataProtectionProvider();
        builder.Services.AddHttpClient<IDriveVaultStore, DriveVaultStore>();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<VaultRepository>();
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("credentials", context => RateLimitPartition.GetFixedWindowLimiter(
                context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
                }));
        });
        builder.Services.AddControllers();
        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        
        var allowedOrigins = builder.Configuration["Frontend:AllowedOrigins"]
            ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            ?? new[] { "http://localhost:5173", "http://localhost:5174" };

        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowFrontend", policy =>
            {
                policy.WithOrigins(allowedOrigins)
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });

        var app = builder.Build();

        app.UseForwardedHeaders();
        // Configure the HTTP request pipeline.
        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseHttpsRedirection();

        app.UseCors("AllowFrontend");

        app.UseRateLimiter();
        app.UseAuthentication();
        // All browser mutations must originate from an explicitly allowed frontend.
        app.Use(async (context, next) =>
        {
            if (context.Request.Path.StartsWithSegments("/api") &&
                !HttpMethods.IsGet(context.Request.Method) &&
                !HttpMethods.IsHead(context.Request.Method) &&
                !HttpMethods.IsOptions(context.Request.Method))
            {
                var origin = context.Request.Headers.Origin.ToString();
                var publicOrigin = builder.Configuration["Frontend:Url"]?.TrimEnd('/');
                if (string.IsNullOrEmpty(origin) ||
                    (!allowedOrigins.Contains(origin) && origin != publicOrigin))
                {
                    context.Response.StatusCode = 403;
                    return;
                }
            }
            await next();
        });
        app.Use(async (context, next) =>
        {
            try { await next(); }
            catch (HttpRequestException e)
            {
                context.Response.StatusCode = e.StatusCode == System.Net.HttpStatusCode.Unauthorized ? 401
                    : e.StatusCode == System.Net.HttpStatusCode.NotFound ? 404 : 502;
                context.Response.ContentType = "application/json";
                await System.Text.Json.JsonSerializer.SerializeAsync(context.Response.Body, new { message = "Google Drive is unavailable or access has expired. Sign in again or retry." });
            }
            catch (InvalidDataException e)
            {
                context.Response.StatusCode = 409;
                context.Response.ContentType = "application/json";
                await System.Text.Json.JsonSerializer.SerializeAsync(context.Response.Body, new { message = e.Message });
            }
        });
        app.UseAuthorization();
        app.UseDefaultFiles();
        app.UseStaticFiles();


        app.MapControllers();
        app.MapGet("/health", () => Results.Ok(new { Status = "ok" }));
        app.MapFallbackToFile("index.html");

        app.Run();
    }
}
