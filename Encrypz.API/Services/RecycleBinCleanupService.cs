using Encrypz.Infrastructure.Data;
using Encrypz.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Encrypz.API.Services
{
    public class RecycleBinCleanupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<RecycleBinCleanupService> _logger;

        public RecycleBinCleanupService(IServiceProvider serviceProvider, ILogger<RecycleBinCleanupService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Recycle Bin Cleanup Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await CleanupRecycleBin(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred executing Recycle Bin Cleanup.");
                }

                // Run every 5 minutes
                await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
            }

            _logger.LogInformation("Recycle Bin Cleanup Service is stopping.");
        }

        private async Task CleanupRecycleBin(CancellationToken stoppingToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var googleDriveService = scope.ServiceProvider.GetRequiredService<IGoogleDriveService>();

            var oneHourAgo = DateTime.UtcNow.AddHours(-1);

            // Cleanup Files
            var filesToDelete = await context.EncryptedFiles
                .Include(f => f.User)
                .Where(f => f.IsDeleted && f.DeletedAt <= oneHourAgo)
                .ToListAsync(stoppingToken);

            foreach (var file in filesToDelete)
            {
                if (!string.IsNullOrEmpty(file.GoogleDriveFileId) && !string.IsNullOrEmpty(file.User.GoogleRefreshToken))
                {
                    try
                    {
                        await googleDriveService.DeleteFileAsync(file.User.GoogleRefreshToken, file.GoogleDriveFileId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Failed to delete file {file.Id} from Google Drive.");
                    }
                }
                
                context.EncryptedFiles.Remove(file);
                _logger.LogInformation($"Permanently deleted file {file.Id}.");
            }

            var foldersToDelete = await context.Folders
                .Where(f => f.IsDeleted && f.DeletedAt <= oneHourAgo)
                .ToListAsync(stoppingToken);
            
            if (foldersToDelete.Any())
            {
                context.Folders.RemoveRange(foldersToDelete);
                _logger.LogInformation($"Permanently deleted {foldersToDelete.Count} folders.");
            }

            if (filesToDelete.Any() || foldersToDelete.Any())
            {
                await context.SaveChangesAsync(stoppingToken);
            }
        }
    }
}
