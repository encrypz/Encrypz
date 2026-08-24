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
                
                // One-to-many relationship
                entity.HasOne(e => e.User)
                      .WithMany(u => u.EncryptedFiles)
                      .HasForeignKey(e => e.UserId)
                      .OnDelete(DeleteBehavior.Cascade);

                // Map cryptographic byte arrays to MySQL VARBINARY and LONGBLOB
                entity.Property(e => e.EncryptedFileName)
                      .HasColumnType("VARBINARY(512)")
                      .IsRequired();

                entity.Property(e => e.Payload)
                      .HasColumnType("LONGBLOB")
                      .IsRequired();

                entity.Property(e => e.InitializationVector)
                      .HasColumnType("VARBINARY(16)")
                      .IsRequired();

                entity.Property(e => e.AuthenticationTag)
                      .HasColumnType("VARBINARY(16)")
                      .IsRequired();
            });
        }
    }
}
