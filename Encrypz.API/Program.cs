using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using MongoDB.Driver;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection;
using Encrypz.Infrastructure.Data;
using Encrypz.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
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

        builder.Services.AddSingleton<IMongoClient>(serviceProvider =>
        {
            var configuration = serviceProvider.GetRequiredService<IConfiguration>();
            var connectionString = configuration["MongoDB:ConnectionString"]
                ?? throw new InvalidOperationException("Configure MongoDB__ConnectionString.");
            if (connectionString.Contains("<db_username>", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Replace the MongoDB database username placeholder in private configuration.");
            var settings = MongoClientSettings.FromConnectionString(connectionString);
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(15);
            return new MongoClient(settings);
        });
        builder.Services.AddSingleton(serviceProvider =>
            serviceProvider.GetRequiredService<IMongoClient>().GetDatabase(
                serviceProvider.GetRequiredService<IConfiguration>()["MongoDB:DatabaseName"] ?? "Encrypz"));
        builder.Services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
            options.UseMongoDB(serviceProvider.GetRequiredService<IMongoClient>(),
                serviceProvider.GetRequiredService<IConfiguration>()["MongoDB:DatabaseName"] ?? "Encrypz"));
        builder.Services.AddDataProtection().SetApplicationName("Encrypz");
        builder.Services.AddSingleton<MongoXmlRepository>();
        builder.Services.AddOptions<KeyManagementOptions>()
            .Configure<MongoXmlRepository>((options, repository) => options.XmlRepository = repository);
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
        
        builder.Services.AddScoped<IGoogleDriveService, GoogleDriveService>();
        if (builder.Configuration.GetValue("RecycleBin:CleanupEnabled", !builder.Environment.IsDevelopment()))
            builder.Services.AddHostedService<RecycleBinCleanupService>();

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

        if (args.Contains("--initialize-db"))
        {
            using var scope = app.Services.CreateScope();
            MongoDatabaseSetup.InitializeAsync(scope.ServiceProvider.GetRequiredService<IMongoDatabase>())
                .GetAwaiter().GetResult();
            return;
        }

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
        app.UseAuthorization();
        app.UseDefaultFiles();
        app.UseStaticFiles();


        app.MapControllers();
        app.MapGet("/health", () => Results.Ok(new { Status = "ok" }));
        app.MapFallbackToFile("index.html");

        app.Run();
    }
}
