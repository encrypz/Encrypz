using Encrypz.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace Encrypz.Infrastructure.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<EncryptedFile> EncryptedFiles { get; set; } = null!;
        public DbSet<Folder> Folders { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // User configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Username).IsRequired().HasMaxLength(256);
            });

            // EncryptedFile configuration
            modelBuilder.Entity<EncryptedFile>(entity =>
            {
                entity.HasKey(e => e.Id);
                
                // Map cryptographic byte arrays to MySQL VARBINARY and LONGBLOB
                entity.Property(e => e.EncryptedFileName)
                      .HasColumnType("VARBINARY(512)")
                      .IsRequired();

                entity.Property(e => e.GoogleDriveFileId)
                      .HasMaxLength(256)
                      .IsRequired();

                entity.Property(e => e.InitializationVector)
                      .HasColumnType("VARBINARY(16)")
                      .IsRequired();

                entity.Property(e => e.AuthenticationTag)
                      .HasColumnType("VARBINARY(16)")
                      .IsRequired();
            });

            // Relationships
            modelBuilder.Entity<EncryptedFile>()
                .HasOne(f => f.User)
                .WithMany(u => u.EncryptedFiles)
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Folder>()
                .HasOne(f => f.User)
                .WithMany()
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Folder>()
                .HasOne(f => f.ParentFolder)
                .WithMany(f => f.SubFolders)
                .HasForeignKey(f => f.ParentFolderId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<EncryptedFile>()
                .HasOne(f => f.Folder)
                .WithMany(f => f.Files)
                .HasForeignKey(f => f.FolderId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
