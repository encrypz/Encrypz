using Encrypz.Core.Entities;
using Microsoft.EntityFrameworkCore;
using MongoDB.EntityFrameworkCore.Extensions;

namespace Encrypz.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; } = null!;
    public DbSet<EncryptedFile> EncryptedFiles { get; set; } = null!;
    public DbSet<Folder> Folders { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToCollection("Users");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Username).IsRequired();
            entity.Ignore(e => e.EncryptedFiles);
        });
        modelBuilder.Entity<EncryptedFile>(entity =>
        {
            entity.ToCollection("EncryptedFiles");
            entity.HasKey(e => e.Id);
            entity.Ignore(e => e.User);
            entity.Ignore(e => e.Folder);
        });
        modelBuilder.Entity<Folder>(entity =>
        {
            entity.ToCollection("Folders");
            entity.HasKey(e => e.Id);
            entity.Ignore(e => e.User);
            entity.Ignore(e => e.ParentFolder);
            entity.Ignore(e => e.SubFolders);
            entity.Ignore(e => e.Files);
        });
    }
}
