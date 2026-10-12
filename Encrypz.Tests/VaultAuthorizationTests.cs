using System.Security.Claims;
using Encrypz.API.Controllers;
using Encrypz.Core.DTOs;
using Encrypz.Core.Entities;
using Encrypz.Infrastructure.Data;
using Encrypz.Infrastructure.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Encrypz.Tests;

public class VaultAuthorizationTests
{
    private static ApplicationDbContext Database() => new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static T AsUser<T>(T controller, Guid id) where T : ControllerBase
    {
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                { new Claim(ClaimTypes.NameIdentifier, id.ToString()) }, "test"))
            }
        };
        return controller;
    }

    [Fact]
    public async Task OtherUsersFilesCannotBeReadChangedOrDeleted()
    {
        using var db = Database();
        var owner = new User { Id = Guid.NewGuid(), Username = "owner" };
        var file = new EncryptedFile { Id = Guid.NewGuid(), UserId = owner.Id, User = owner,
            GoogleDriveFileId = "remote", EncryptedFileName = new byte[] { 1 },
            InitializationVector = new byte[] { 1 }, AuthenticationTag = new byte[] { 1 } };
        db.Users.Add(owner);
        db.EncryptedFiles.Add(file);
        await db.SaveChangesAsync();
        var controller = AsUser(new FilesController(db, new NoDriveCalls()), Guid.NewGuid());
        Assert.IsType<ForbidResult>(await controller.ListFiles(owner.Id, null));
        Assert.IsType<ForbidResult>(await controller.GetDeletedFiles(owner.Id));
        Assert.IsType<NotFoundObjectResult>(await controller.DownloadFile(file.Id));
        Assert.IsType<NotFoundObjectResult>(await controller.DeleteFile(file.Id));
        Assert.IsType<NotFoundObjectResult>(await controller.RestoreFile(file.Id));
        Assert.IsType<NotFoundObjectResult>(await controller.PermanentDeleteFile(file.Id));
        Assert.False(file.IsDeleted);
        Assert.Equal(1, await db.EncryptedFiles.CountAsync());
    }

    [Fact]
    public async Task UploadRejectsSpoofedOwnerAndForeignFolderBeforeCallingDrive()
    {
        using var db = Database();
        var id = Guid.NewGuid();
        var controller = AsUser(new FilesController(db, new NoDriveCalls()), id);
        Assert.IsType<ForbidResult>(await controller.Upload(new FileUploadDto { UserId = Guid.NewGuid() }));
        Assert.IsType<BadRequestObjectResult>(await controller.Upload(new FileUploadDto
            { UserId = id, FolderId = Guid.NewGuid() }));
    }

    [Fact]
    public async Task FoldersAndProfilesEnforceOwnership()
    {
        using var db = Database();
        var id = Guid.NewGuid();
        var other = Guid.NewGuid();
        var folder = new Folder { Id = Guid.NewGuid(), UserId = other,
            EncryptedFolderName = new byte[] { 1 }, InitializationVector = new byte[] { 1 },
            AuthenticationTag = new byte[] { 1 } };
        db.Folders.Add(folder);
        await db.SaveChangesAsync();
        var controller = AsUser(new FoldersController(db), id);
        Assert.IsType<ForbidResult>(await controller.GetFolders(other, null));
        Assert.IsType<NotFoundObjectResult>(await controller.DeleteFolder(folder.Id));
        Assert.IsType<BadRequestObjectResult>(await controller.CreateFolder(new FoldersController.CreateFolderDto
            { UserId = id, ParentFolderId = folder.Id }));
        var auth = AsUser(new AuthController(db, new ConfigurationBuilder().Build()), id);
        Assert.IsType<ForbidResult>(await auth.GetUserProfile(other));
    }

    [Fact]
    public async Task OwnerCanListAndSoftDeleteOwnFile()
    {
        using var db = Database();
        var id = Guid.NewGuid();
        var file = new EncryptedFile { Id = Guid.NewGuid(), UserId = id,
            GoogleDriveFileId = "remote", EncryptedFileName = new byte[] { 1 },
            InitializationVector = new byte[] { 1 }, AuthenticationTag = new byte[] { 1 } };
        db.EncryptedFiles.Add(file);
        await db.SaveChangesAsync();
        var controller = AsUser(new FilesController(db, new NoDriveCalls()), id);
        Assert.IsType<OkObjectResult>(await controller.ListFiles(id, null));
        Assert.IsType<NoContentResult>(await controller.DeleteFile(file.Id));
        Assert.True(file.IsDeleted);
    }

    [Fact]
    public async Task DeletingFolderDetachesFilesAndRejectsNonemptyHierarchy()
    {
        using var db = Database();
        var id = Guid.NewGuid();
        var folder = new Folder { Id = Guid.NewGuid(), UserId = id,
            EncryptedFolderName = new byte[] { 1 }, InitializationVector = new byte[] { 1 },
            AuthenticationTag = new byte[] { 1 } };
        var child = new Folder { Id = Guid.NewGuid(), UserId = id, ParentFolderId = folder.Id,
            EncryptedFolderName = new byte[] { 1 }, InitializationVector = new byte[] { 1 },
            AuthenticationTag = new byte[] { 1 } };
        var file = new EncryptedFile { Id = Guid.NewGuid(), UserId = id, FolderId = folder.Id,
            GoogleDriveFileId = "remote", EncryptedFileName = new byte[] { 1 },
            InitializationVector = new byte[] { 1 }, AuthenticationTag = new byte[] { 1 } };
        db.Folders.AddRange(folder, child);
        db.EncryptedFiles.Add(file);
        await db.SaveChangesAsync();
        var controller = AsUser(new FoldersController(db), id);
        Assert.IsType<ConflictObjectResult>(await controller.DeleteFolder(folder.Id));
        Assert.IsType<NoContentResult>(await controller.DeleteFolder(child.Id));
        Assert.IsType<NoContentResult>(await controller.DeleteFolder(folder.Id));
        Assert.Null(file.FolderId);
        Assert.Equal(1, await db.EncryptedFiles.CountAsync());
    }

    private sealed class NoDriveCalls : IGoogleDriveService
    {
        public Task<string> UploadFileAsync(string token, byte[] bytes, string name) => throw new Exception("Unexpected Drive call");
        public Task<byte[]> DownloadFileAsync(string token, string id) => throw new Exception("Unexpected Drive call");
        public Task DeleteFileAsync(string token, string id) => throw new Exception("Unexpected Drive call");
    }
}
